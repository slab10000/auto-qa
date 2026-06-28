// Code-side review via a remote Gemini managed agent (Antigravity).
// Three modes, all running in an ephemeral remote sandbox:
//   codeReview()       — review a diff passed as text (used by the local-diff path,
//                        whose repo never reaches GitHub so there's no URL to clone).
//   remoteReview()     — given a repo URL + PR refs, the agent CLONES it, RUNS the app to
//                        verify it boots, and reviews the diff against the stated scope.
//   remotePostComment()— the agent POSTS the review comment to the PR from inside the
//                        sandbox, using a dedicated bot token (never your personal gh login).
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});
const AGENT = "antigravity-preview-05-2026";

const stepsText = (res) =>
  (res.steps || [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => (s.content || []).map((c) => c.text || ""))
    .join("\n")
    .trim();

function parseJSON(text, fallback) {
  if (!text) return fallback;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try { return JSON.parse(raw.slice(s, e + 1)); } catch {}
    }
    return fallback;
  }
}

// Surface what the sandbox actually executed (redacted) so the run is observable.
function emitSteps(res, emit, redact = (s) => s) {
  for (const s of res.steps || []) {
    if (s.type === "code_execution_call") {
      emit({ type: "remote_exec", code: redact(s.arguments?.code || "") });
    } else if (s.type === "code_execution_result") {
      emit({ type: "remote_result", result: redact((s.result || "").slice(0, 600)), is_error: !!s.is_error });
    }
  }
}

// --- Mode 1: review a diff passed as text (local-diff path) -------------
export async function codeReview(pr, diff, changedFiles, { onEvent } = {}) {
  const emit = onEvent || (() => {});
  emit({ type: "phase", phase: "code-review", message: "Managed agent reviewing the diff in a remote sandbox" });

  const res = await ai.interactions.create({
    agent: AGENT,
    environment: "remote",
    input:
      `You are a senior code reviewer. Review this pull request's diff against its STATED scope and ` +
      `flag any changes that are risky or were not declared in the scope.\n\n` +
      `PR title: ${pr.title}\nPR description: ${pr.description}\n\n` +
      `Changed files: ${changedFiles.join(", ")}\n\nDiff:\n${diff}\n\n` +
      `Reply with ONLY a JSON object and nothing else: ` +
      `{"scope_match":"aligned|scope_creep|unclear","risk":"low|medium|high","summary":string,"concerns":[string]}.`,
  });

  const text = res.output_text || stepsText(res);
  const parsed = parseJSON(text, { scope_match: "unclear", risk: "unknown", summary: text, concerns: [] });
  const result = {
    ...parsed,
    environment_id: res.environment_id || null,
    ran_in: "remote managed agent · antigravity",
  };
  emit({ type: "code_review", ...result });
  return result;
}

// --- Mode 2: clone + RUN + review straight from the repo URL (GitHub path) ----
// The agent does the whole thing autonomously: clone the repo, check out the PR
// head, start/serve the app and verify it actually responds, then review the diff.
export async function remoteReview({ repo, prNumber, title, body, baseRef, headRef }, { onEvent } = {}) {
  const emit = onEvent || (() => {});
  emit({
    type: "phase", phase: "remote-review",
    message: `Managed agent cloning, running, and reviewing ${repo}#${prNumber} in a remote sandbox`,
  });

  const cloneUrl = `https://github.com/${repo}.git`;
  const input =
    `You are a senior QA + code reviewer in a fresh Linux sandbox that has git, node, npm, python3 and curl.\n` +
    `Do EVERYTHING below with shell/code execution, then report. Work in /tmp/pr.\n\n` +
    `Repository: ${cloneUrl}\nBase branch: ${baseRef}\nPR head branch: ${headRef}\n` +
    `PR title: ${title}\nPR description: ${body || "(none)"}\n\n` +
    `STEP 1 — Get the PR code:\n` +
    `  git clone ${cloneUrl} /tmp/pr && cd /tmp/pr\n` +
    `  git fetch origin ${baseRef} ${headRef} && git checkout ${headRef}\n` +
    `STEP 2 — Compute the diff you will review:\n` +
    `  git diff origin/${baseRef}...origin/${headRef}\n` +
    `STEP 3 — RUN THE APP and confirm it actually works:\n` +
    `  - If package.json exists with a build/start script: install deps (npm ci || npm install), run the build, then start/serve it.\n` +
    `  - If it is a static site (.html files, no build step): serve the repo root with 'python3 -m http.server 8000 &'.\n` +
    `  - Then PROVE it responds: curl -s -o /dev/null -w '%{http_code}' each main page/route. Treat build errors or non-2xx/3xx responses as a failure.\n` +
    `STEP 4 — Review the STEP 2 diff against the STATED scope (title/description). Flag anything risky or not declared (scope creep).\n\n` +
    `Reply with ONLY a JSON object and nothing else:\n` +
    `{"ran_ok":true|false,"run_method":string,"run_evidence":string,` +
    `"scope_match":"aligned|scope_creep|unclear","risk":"low|medium|high",` +
    `"summary":string,"concerns":[string]}`;

  const res = await ai.interactions.create({ agent: AGENT, environment: "remote", input });
  emitSteps(res, emit);

  const text = res.output_text || stepsText(res);
  const parsed = parseJSON(text, {
    ran_ok: null, run_method: "unknown", run_evidence: text,
    scope_match: "unclear", risk: "unknown", summary: text, concerns: [],
  });
  const result = {
    ...parsed,
    environment_id: res.environment_id || null,
    ran_in: "remote managed agent · antigravity",
  };
  emit({ type: "code_review", ...result });
  return result;
}

// --- Mode 3: the agent POSTS the comment to the PR from the sandbox -----------
// Token-gated: only runs when a dedicated bot token is provided. The comment is
// authored by whatever GitHub account owns that token — NOT your personal login.
// The body is shipped as base64 to dodge all shell/JSON quoting hazards.
export async function remotePostComment({ repo, prNumber, body }, { token, onEvent, dryRun } = {}) {
  const emit = onEvent || (() => {});
  if (!token) throw new Error("remotePostComment: no bot token provided");
  const b64 = Buffer.from(body, "utf8").toString("base64");

  const input =
    `Post a comment to a GitHub pull request via the REST API. SECURITY: never print, echo, or reveal the token.\n` +
    `Run exactly these commands with code execution:\n` +
    `export GH_TOKEN='${token}'\n` +
    `printf %s '${b64}' | base64 -d > /tmp/body.md\n` +
    `python3 - <<'PY'\n` +
    `import json, os, urllib.request\n` +
    `body = open('/tmp/body.md').read()\n` +
    `req = urllib.request.Request(\n` +
    `    'https://api.github.com/repos/${repo}/issues/${prNumber}/comments',\n` +
    `    data=json.dumps({'body': body}).encode(),\n` +
    `    headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],\n` +
    `             'Accept': 'application/vnd.github+json', 'User-Agent': 'auto-qa-bot'})\n` +
    `try:\n` +
    `    r = urllib.request.urlopen(req); d = json.load(r)\n` +
    `    print(json.dumps({'posted': True, 'comment_url': d.get('html_url')}))\n` +
    `except Exception as e:\n` +
    `    print(json.dumps({'posted': False, 'comment_url': None, 'error': str(e)}))\n` +
    `PY\n` +
    `Then reply with ONLY the JSON object that the python printed.`;

  if (dryRun) return { input, b64 };

  const redact = (s) => (s || "").split(token).join("<token>");
  emit({ type: "phase", phase: "remote-post", message: `Managed agent posting the review to ${repo}#${prNumber} from the sandbox` });
  const res = await ai.interactions.create({ agent: AGENT, environment: "remote", input });
  emitSteps(res, emit, redact);
  const parsed = parseJSON(redact(res.output_text || stepsText(res)), { posted: false, comment_url: null });
  emit({ type: "remote_post", ...parsed });
  return parsed;
}
