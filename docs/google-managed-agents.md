# Giving Google Managed Agents Access to a Repo

auto-qa should keep the visualization and artifact store local, while Gemini Managed Agents do the expensive remote work.

The access model is:

1. The local coordinator calls the Gemini Interactions API.
2. The request provisions or resumes a remote managed-agent environment.
3. The environment mounts the target Git repository into the sandbox.
4. The agent runs tests, explores the app, writes artifacts, and returns a report.
5. The agent writes an artifact tree under `/workspace/autoqa-output`.
6. The local coordinator downloads the environment snapshot and imports that tree into `.autoqa/` for the webapp.

The UI supports both modes:

- `demo`: deterministic local artifacts for a reliable hackathon demo.
- `google`: real Gemini managed-agent calls using the repo URL and API key you paste into the setup form.

## Public Repositories

For a public repo, pass the repository URL as an environment source:

```json
{
  "agent": "antigravity-preview-05-2026",
  "input": [
    {
      "type": "text",
      "text": "Analyze this repo and write auto-qa artifacts."
    }
  ],
  "environment": {
    "type": "remote",
    "sources": [
      {
        "type": "repository",
        "source": "https://github.com/your-org/your-repo",
        "target": "/workspace/repo"
      }
    ]
  }
}
```

## Private Repositories

For a private GitHub repo, create a fine-grained GitHub personal access token with the smallest useful scope.

For the first prototype:

- Repository access: only the target repo.
- Permissions: contents read-only.
- Later, for PR comments or webhook automation, add pull request or issue permissions as needed.

Google's docs show private repository access by injecting a Basic auth header through the environment network allowlist. The token is not written as a file inside the sandbox.

The local coordinator converts the PAT to this form:

```txt
base64("x-oauth-basic:<GITHUB_PAT>")
```

Then it sends:

```json
{
  "environment": {
    "type": "remote",
    "sources": [
      {
        "type": "repository",
        "source": "https://github.com/your-org/your-private-repo",
        "target": "/workspace/repo"
      }
    ],
    "network": {
      "allowlist": [
        {
          "domain": "github.com",
          "transform": {
            "Authorization": "Basic <BASE64_TOKEN>"
          }
        },
        {
          "domain": "api.github.com",
          "transform": {
            "Authorization": "Basic <BASE64_TOKEN>"
          }
        },
        {
          "domain": "*"
        }
      ]
    }
  }
}
```

## Resuming PR Agents

The response includes:

- `environment_id`
- interaction id
- output text

Store these in the PR metadata:

```json
{
  "agent_environment_id": "env_abc123",
  "previous_interaction_id": "interaction_abc123"
}
```

When the PR receives another commit, call the Interactions API again with:

```json
{
  "environment": "env_abc123",
  "previous_interaction_id": "interaction_abc123"
}
```

That resumes the same remote environment, including files and learned state.

## Downloading Artifacts

The managed environment can be downloaded as a tar snapshot via the Files API. auto-qa imports only the `/workspace/autoqa-output` directory from that snapshot.

```txt
GET https://generativelanguage.googleapis.com/v1beta/files/environment-<ENV_ID>:download?alt=media
```

The remote agent is instructed to create one of these trees:

```txt
/workspace/autoqa-output/main/
  state.json
  behavior-graph.json
  behaviors/*.json
  screenshots/*.png
  skills/*.md
  reports/latest.md
  runs/<run-id>.json

/workspace/autoqa-output/prs/pr-1/
  metadata.json
  scope.json
  behavior-diff.json
  screenshots/*.png
  skills/*.md
  reports/latest.md
  runs/<run-id>.json
```

If snapshot download fails, the coordinator still saves the managed-agent text output into a fallback report so the run is not invisible.

## Computer Use

Computer Use is the screenshot/action loop. The remote agent prompt tells the managed agent to use Gemini Computer Use if that tool is exposed inside the managed environment. If not, it falls back to Playwright as the browser action executor and the managed agent's visual reasoning over screenshots.

In both cases, the required result is the same:

- screenshots in `screenshots/*.png`
- a run file recording `computer_use_path`
- behavior contracts or behavior diffs
- a human-readable report

## References

- Gemini Managed Agents environments: https://ai.google.dev/gemini-api/docs/agent-environment
- Gemini agents overview: https://ai.google.dev/gemini-api/docs/agents
- Gemini Computer Use: https://ai.google.dev/gemini-api/docs/computer-use
