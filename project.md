# auto-qa Project Brief

## Working Title

**auto-qa** is a self-improving QA system for software projects.

Possible product names:

- BranchMind QA
- ReplayQA
- MergeGuard
- QA Memory
- Forkwise

The strongest current framing is:

> A self-improving QA agent that learns a software product the way a human QA engineer does.

## Core Idea

Modern teams already run tests, screenshots, and code review, but most quality checks are static and forgetful. A human QA engineer gets better over time because they learn the product: important workflows, normal behavior, risky screens, shortcuts, edge cases, and where regressions usually appear.

auto-qa tries to replicate that learning loop with Gemini managed agents.

The system connects to a GitHub repository, learns the behavior of the app on the main branch, stores that knowledge as a living product memory, and then uses that memory to review pull requests. Each PR gets its own persistent agent session that can inherit knowledge from main, learn branch-specific behavior, and continue improving across PR updates.

If the PR is merged, the knowledge learned on that branch can be merged into the main product memory. If the PR is closed or rejected, the branch-specific knowledge is not merged.

This mirrors how real software work happens:

- Main branch represents the current accepted product.
- A PR branch represents an experimental future state.
- The QA agent for that branch learns the new feature while the PR evolves.
- Only accepted product behavior becomes permanent main knowledge.

## Hackathon Fit

This project is designed for the 2026 AI Engineer World's Fair Hackathon.

It fits the required themes especially well:

- **Continual Learning:** The system improves from each run by saving learned workflows, behavior contracts, screenshots, and testing strategies.
- **The Self-Improvement Stack:** It is infrastructure for evaluating and monitoring software quality over time.
- **Recursive Intelligence / Self-Improvement:** Agents write and refine their own testing knowledge, skills, and behavioral specs.

It is also a strong candidate for the Gemini 3.5 prize because it can combine:

- **Managed Agents / Interactions API:** One persistent Gemini-managed agent per repo, branch, or PR.
- **Stateful session resume:** Resume the same managed agent environment whenever a PR is updated.
- **Computer Use in Gemini 3.5 Flash:** Let agents see the app through screenshots and interact with the UI like a real tester.

Important hackathon constraint:

- The webapp must not be the main feature. The agentic testing and self-improving QA loop must be the star. The UI should be an evidence viewer, not just a dashboard.

## Product Vision

auto-qa creates and maintains a living model of an application:

- What screens exist
- How to navigate between them
- What each screen is for
- What buttons, forms, links, and flows do
- What screenshots look like in known good states
- What test commands should pass
- What workflows are critical
- What behavior changed in a PR
- Whether those changes appear to be in scope

The system should feel less like a screenshot diff tool and more like a junior QA engineer who keeps learning the product.

## Main Branch Knowledge

The main branch has canonical product knowledge. This is the accepted understanding of the app.

Examples of main knowledge:

- Screens and routes
- Navigation flows
- Known modals and drawers
- Form behavior
- Empty states
- Loading states
- Error states
- Expected visual baselines
- Test commands
- Important user journeys
- Notes about flaky or fragile areas
- Shortcuts for reaching key states

For example:

```txt
Dashboard
  -> click Settings button
    -> navigates to Settings page
       expected URL: /settings
       expected visual anchor: "Settings" heading visible
       evidence: screenshots/main/dashboard-before-settings.png
       evidence: screenshots/main/settings-page-after-click.png
```

## Behavior Contracts

The most important memory object is a **behavior contract**.

A behavior contract describes what should happen when a user takes an action in the app.

Example:

```json
{
  "screen": "Dashboard",
  "action": "click settings button",
  "expected_result": {
    "type": "navigation",
    "destination": "Settings page",
    "url_change": "/settings",
    "visual_anchor": "Settings heading visible"
  },
  "evidence": {
    "before_screenshot": "dashboard.png",
    "after_screenshot": "settings-page.png"
  },
  "confidence": 0.92,
  "learned_from": "main",
  "last_verified_at": "latest-main-run"
}
```

On a pull request, the agent replays the contract and records the observed result:

```json
{
  "screen": "Dashboard",
  "action": "click settings button",
  "observed_result": {
    "type": "modal",
    "modal_title": "Settings",
    "url_change": false
  },
  "evidence": {
    "before_screenshot": "pr-dashboard-before-settings.png",
    "after_screenshot": "pr-settings-modal-after-click.png"
  }
}
```

If main says the settings button should navigate to a settings page, but the PR opens a modal instead, auto-qa flags a behavioral mismatch.

The system should then ask:

1. What changed?
2. Is the change in the scope of this PR?
3. What evidence proves the change?
4. How severe is the mismatch?

Example report:

```txt
Behavioral mismatch detected

Action:
  Click Settings button on Dashboard

Main behavior:
  Navigates to Settings page at /settings

PR behavior:
  Opens a Settings modal without changing URL

Scope analysis:
  The PR title and changed files suggest this PR updates billing copy.
  No settings navigation change is mentioned.

Verdict:
  Likely unrelated regression. Needs human review.

Evidence:
  - Main before screenshot
  - Main after screenshot
  - PR before screenshot
  - PR after screenshot
  - Action trace
```

## Visual and Behavioral Regression

auto-qa should compare more than pixels.

It should combine:

- Screenshot comparison
- UI action replay
- URL and route changes
- DOM or accessibility snapshots
- Console errors
- Network failures
- Test command results
- PR intent analysis
- Agent judgment over expected vs observed behavior

Visual diffs are useful evidence, but behavior is the core product.

Example:

- Main: clicking Settings navigates to a new page.
- PR: clicking Settings opens a modal.
- Pixel diff: yes, the UI changed.
- Behavioral diff: the navigation model changed.
- Scope check: if the PR is about settings redesign, acceptable. If the PR is about billing copy, suspicious.

## PR Scope Analysis

When a PR is opened or updated, auto-qa should infer the intended scope of the change from:

- PR title
- PR description
- Commit messages
- Changed files
- Code diff
- Linked issue, if available
- Developer-provided notes, if available

Then it compares observed changes against that scope.

Possible verdicts:

- **Expected change:** The behavior changed, and the PR scope explains it.
- **Suspicious change:** The behavior changed, but the PR scope does not explain it.
- **Regression:** The behavior changed and breaks an existing contract.
- **Needs human review:** The system is uncertain or the evidence is ambiguous.
- **No issue:** Behavior matches main expectations.

## Branch-Specific Knowledge

Every PR branch can have its own knowledge fork.

Main memory:

```txt
memory/main/
  screens/
  behaviors/
  skills/
  screenshots/
  reports/
```

PR memory:

```txt
memory/pr-42/
  inherited_from: main
  managed_agent_environment_id: env_pr_42
  screens/
  behaviors/
  skills/
  screenshots/
  reports/
```

The PR agent starts with main knowledge, then learns the branch.

If the branch introduces a new feature, the PR agent learns how to test it. If the PR changes a workflow intentionally, the PR agent stores that new behavior in branch memory. The same session can be resumed every time the PR receives new commits.

When the PR merges:

- Accepted new behavior contracts merge into main memory.
- New testing skills merge into main memory.
- New screenshots become main baselines.
- Branch-specific temporary notes can be archived.

When the PR is closed without merging:

- Branch knowledge is not merged into main.
- The system may archive it for audit/history, but it should not become canonical product knowledge.

## Self-Improvement Loop

While idle, the system should improve its own testing knowledge.

Examples:

- Explore the app and discover screens.
- Identify important workflows.
- Create better routes for reaching deep states.
- Convert repeated manual steps into reusable skills.
- Update behavior contracts after successful verification.
- Mark flaky checks and retry strategies.
- Learn which screenshots are most useful as evidence.
- Prioritize high-risk areas based on past regressions.

The first run may be slow because the agent is learning. Later runs should become faster and more focused because the agent knows where to go and what matters.

This is the central product loop:

```txt
Explore -> Learn -> Save Memory -> Replay -> Compare -> Report -> Improve
```

## Managed Agent Model

The system should use Gemini managed agents as persistent QA workers.

Suggested agent/session structure:

- **Repo Agent:** Owns canonical understanding of the repository.
- **Main QA Agent:** Maintains main branch product memory.
- **PR QA Agent:** Forked per PR; tests the PR branch and learns branch-specific changes.
- **Idle Improvement Agent:** Uses downtime to expand and refine test coverage.

Each managed agent session should have access to:

- Cloned repository
- Branch checkout
- App runtime
- Test commands
- Screenshots and traces
- Memory files
- App-specific skills

The important Gemini feature is environment/session resume:

- A PR update resumes the same PR agent.
- The agent keeps files, notes, learned skills, and terminal state.
- The agent becomes increasingly familiar with that PR over time.

## Skills and Memory

Agents should be able to create and refine app-specific skills.

Example skills:

```txt
skills/login.md
skills/create-project.md
skills/reach-billing-page.md
skills/reset-test-data.md
skills/verify-settings-navigation.md
```

Example `verify-settings-navigation.md`:

```txt
# Verify Settings Navigation

Context:
The Settings entry point appears in the top-right dashboard toolbar.

Steps:
1. Open dashboard.
2. Click the Settings button.
3. Expect navigation to /settings.
4. Confirm the Settings heading appears.
5. Capture before and after screenshots.

Known risks:
- Settings sometimes appears in account menu on mobile.
- If a modal opens instead, compare against PR scope before flagging.
```

These skills are part of the self-improvement story. The agent is not only running tests. It is teaching future versions of itself how to test the app better.

## Evidence

Every report should include evidence.

Evidence types:

- Screenshots before and after action
- Screenshot diffs
- Video replay or trace
- Browser console logs
- Failed test output
- DOM or accessibility snapshots
- Route/URL before and after
- Agent action log
- Behavior contract comparison
- PR scope analysis

The demo should show the evidence clearly. Judges should be able to see the system testing the app, not just reading a static report.

## Webapp

The webapp is useful, but it should support the agentic product rather than replace it.

Possible webapp views:

- Repositories
- Main branch product memory
- PR review reports
- Behavior graph
- Screenshots history
- Before/after comparisons
- Agent replays
- Learned skills
- Branch memory diff
- Merge knowledge preview

The app should feel like an evidence cockpit:

- What does the agent know?
- What did it test?
- What changed?
- Why does it think the change matters?
- What evidence supports the claim?

The main feature is still the self-improving QA agent.

## GitHub Integration

Expected flow:

1. User connects a GitHub repository.
2. auto-qa clones the repo.
3. auto-qa learns the main branch.
4. A PR is opened or updated.
5. auto-qa creates or resumes a managed agent for that PR.
6. The PR agent checks out the branch.
7. The PR agent runs tests.
8. The PR agent starts the app.
9. The PR agent replays known behavior contracts.
10. The PR agent captures screenshots and traces.
11. The PR agent compares observed behavior to main memory.
12. The PR agent checks whether changes match the PR scope.
13. auto-qa generates a PR report.
14. If the PR merges, learned branch knowledge merges into main memory.

## PR Report

A PR report should include:

- Overall verdict
- Test command results
- Behavioral mismatches
- Visual diffs
- Scope analysis
- Severity
- Evidence
- Agent confidence
- Suggested human review items
- Newly learned branch knowledge

Example verdicts:

```txt
PASS
No unexpected behavior changes found.

WARN
Expected changes found, but one area needs human review.

FAIL
Unexpected behavior change outside PR scope.

BLOCKED
The app could not be started or tested.
```

## Hackathon MVP

The MVP should avoid trying to build a complete SaaS. The most important demo is the agentic QA loop.

Suggested hackathon MVP:

1. Use a small sample app with 3 to 5 screens.
2. Run main branch onboarding.
3. Generate product memory:
   - screens
   - behavior contracts
   - screenshots
   - a few skills
4. Create a PR branch with:
   - one intended change
   - one unintended behavior regression
5. Resume or create a PR-specific Gemini managed agent.
6. Run tests.
7. Replay learned behavior.
8. Detect the unexpected behavior change.
9. Generate a report with screenshots and reasoning.
10. Show branch memory and explain that it only merges into main if the PR merges.

Best demo scenario:

- Main behavior: clicking the Settings button navigates to a Settings page.
- PR scope: update billing copy or styling.
- PR behavior: clicking the Settings button opens a Settings modal.
- auto-qa flags this as suspicious because the behavior changed outside the stated PR scope.
- The report includes before/after screenshots and a behavior contract diff.

## Demo Story

The demo should tell this story:

1. A new QA engineer starts on a project and first needs to learn the app.
2. auto-qa does the same on main: it explores, takes screenshots, and writes behavior contracts.
3. A developer opens a PR.
4. auto-qa gives that PR its own persistent Gemini agent.
5. The agent inherits main knowledge and tests the PR.
6. The agent notices that Settings behavior changed unexpectedly.
7. It checks the PR scope and sees the change is unrelated.
8. It reports the issue with evidence.
9. The PR branch has learned knowledge, but that knowledge only becomes main knowledge if the PR merges.

This makes the system feel like a living QA teammate, not a static CI check.

## Differentiators

auto-qa is different from ordinary CI because:

- It learns the product over time.
- It tests behavior, not only code.
- It uses visual computer use, not only selectors.
- It can resume PR-specific agent sessions.
- It forks and merges knowledge like Git branches.
- It stores evidence of what was tested.
- It can improve its own testing skills during idle time.

It is different from basic visual regression testing because:

- It understands actions and expected outcomes.
- It reasons about PR scope.
- It can decide whether a change is expected or suspicious.
- It keeps a product memory, not just image baselines.

## Open Product Questions

- How should main memory resolve conflicts when branch knowledge merges?
- What confidence threshold should block a PR vs ask for review?
- How much should agents rely on screenshots vs DOM/accessibility snapshots?
- Should memory be stored as files, database records, or both?
- How should developers approve an intentional behavior change?
- Can developers write hints in the PR description to guide the agent?
- How should the system handle flaky UI behavior?
- How should the system avoid learning a bug as correct behavior?

## Near-Term Build Plan

Recommended first version:

1. Build a sample app or use a small existing app.
2. Create a local memory format for screens, behaviors, screenshots, and skills.
3. Implement main branch onboarding.
4. Implement PR branch replay.
5. Implement behavior mismatch detection.
6. Generate a markdown or HTML report with evidence.
7. Add a lightweight web UI only after the core loop works.

## One-Sentence Pitch

auto-qa gives every pull request a persistent Gemini QA agent that inherits product knowledge from main, learns how to test new features while the branch evolves, and only merges that knowledge back when the code itself is merged.

