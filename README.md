# auto-qa

> A self-improving QA agent that learns your product the way a human QA engineer does — then reviews pull requests with **Gemini 3.5 Computer Use**.

<p>
  <img alt="Gemini 3.5" src="https://img.shields.io/badge/Gemini-3.5%20Flash-7c83ff" />
  <img alt="Computer Use" src="https://img.shields.io/badge/Computer%20Use-eyes%20%26%20hands-34d399" />
  <img alt="Managed Agents" src="https://img.shields.io/badge/Managed%20Agents-Antigravity-fbbf24" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000" />
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-driver-2EAD33" />
</p>

Most quality checks are static and forgetful. A human QA engineer gets better over time because they **learn the product** — its screens, its normal behavior, where regressions hide. **auto-qa** replicates that learning loop: it explores an app, builds a living **product memory**, and then uses that memory to review every pull request — catching behavior changes that slip outside the PR's stated scope.

It's not a screenshot-diff tool. It understands *actions and expected outcomes*, reasons about whether a change was *intended*, and gets **faster and smarter every run**.

---

## The core loop

```
   Explore  ──►  Learn  ──►  Replay  ──►  Compare  ──►  Report  ──►  Improve
   (Computer    (product     (behavior    (main vs PR   (verdict +    (cache routes,
    Use)         memory)      contracts)   screenshots)  evidence)     merge knowledge)
        ▲                                                                   │
        └───────────────────────────────────────────────────────────────────┘
```

- **Main branch** = the accepted product. auto-qa learns it: screens, navigation, behavior contracts, baseline screenshots.
- **Pull request** = an experimental future state. auto-qa gives it a review that inherits main's knowledge, replays the contracts, and flags anything unexpected.
- **Merge** = only *accepted* behavior graduates into main memory. Rejected PRs never poison the baseline.

---

## What it does

| Capability | How |
| --- | --- |
| 🧭 **Learns the app** | Drives the UI with Computer Use, captures screens, writes AI descriptions + baseline screenshots into a file-based **product memory**. |
| 📜 **Behavior contracts** | Records what *should* happen on an action (e.g. *click Settings → navigate to `/settings`*). On a PR it replays the contract and records what *did* happen. |
| 👁️ **Two-pass PR review** | **Pass 1** — Computer Use replays the flows and captures the PR's screens. **Pass 2** — a multimodal call diffs each screen *main vs PR* and rates severity. |
| 🎯 **Scope analysis** | Infers the PR's intent from its title/description/diff and decides whether each observed change is **in scope** or **suspicious / out-of-scope**. |
| 🧠 **Code-side review** | A remote **Gemini Managed Agent** (Antigravity) reads the diff in an ephemeral sandbox and posts its own scope/risk assessment — a second, independent perspective. |
| ⚡ **Learned routes** | The first time it reaches a screen it explores; it then **caches the action route** and replays it on later passes with **zero model calls** (~16× faster), re-exploring only if the UI actually changed. |
| ♻️ **Self-improvement** | On merge, accepted contracts + skills + baselines fold into main, and every merged branch leaves a **visual history** snapshot. |
| 🪟 **Watch it think** | A live cockpit streams every Computer Use action, its stated intent, and the exact screen it sees — in real time. |
| 🐙 **Real GitHub PRs** | Points at any GitHub PR, captures its pages, runs the full review, and **posts the verdict as a PR comment**. |

---

## Powered by two Gemini 3.5 features

- **🖥️ Computer Use** (`gemini-3.5-flash`) — the *eyes and hands*. A local Playwright loop feeds screenshots to the model, which returns native UI actions (click / type / scroll) with normalized coordinates and a natural-language **intent** for every step.
- **🚀 Managed Agents** (`antigravity-preview-05-2026`) — the *code-side brain*. One API call spins up an ephemeral Linux sandbox that clones the repo, reads the diff, and reasons about scope and risk.

Computer Use runs **locally** (full control, a visible browser, fast iteration); the *intelligence* is always remote Gemini calls.

---

## The demo — a real GitHub repo

auto-qa points at a real GitHub repository ([`slab10000/test-app`](https://github.com/slab10000/test-app) by default — override with `AUTOQA_REPO=owner/name`). It clones `main`, learns the app, then reviews an open PR and **posts the verdict as a PR comment**:

```
🟡 WARN — needs_review
Stated scope: "Update Store page copy"
Visual: Home — changed (medium): the landing hero headline was rewritten (out of scope)
Scope analysis: the Store copy is in scope; the homepage hero change is NOT.
```

Every page is driven in a real Chromium browser by Computer Use, diffed main-vs-PR, and cross-checked by a remote managed agent reading the diff.

---

## Getting started

**Prerequisites:** Node 20+, a [Gemini API key](https://aistudio.google.com/api-keys), and the [`gh`](https://cli.github.com) CLI authenticated (the agent clones the target repo and posts review comments through it).

```bash
npm install
npx playwright install chromium
cp .env.example .env.local        # then add your GEMINI_API_KEY
```

**Run the cockpit** (browse the product memory, reports, and live runs):

```bash
npm run dev                       # → http://localhost:3000
```

**Drive the agent from the CLI** (targets `slab10000/test-app`; override with `AUTOQA_REPO`):

```bash
npm run onboard                   # clone the repo's main, explore it → product memory
npm run review 1                  # review PR #1 → verdict + evidence, and post a PR comment
npm run agent -- merge pr-1       # approve & fold the PR's knowledge into main

# review any repo's PR directly:
npm run github-review -- <owner/repo> <pr-number>
```

> The agent clones the target repo on demand (into gitignored `.autoqa/**/repo/`). The committed `.autoqa/` evidence lets the cockpit show the last review before you run anything.

---

## The cockpit

| Route | What you see |
| --- | --- |
| `/` | **Product memory** — learned screens, behavior contracts, learned routes, PR reports, and the screenshot history of merged branches. |
| `/run` | **Watch it think** — trigger a run and stream the agent's actions + intents + screens live; ⚡cached vs 🔎explored per step. |
| `/pr/[id]` | **PR report** — verdict, behavior-contract replay, main-vs-PR visual evidence, scope analysis, and the managed-agent code review. |

---

## Project structure

```
auto-qa/
├─ qa-agent/            the agent (plain ESM, no build step)
│  ├─ gemini.mjs        Computer Use loop + multimodal reasoning
│  ├─ executor.mjs      Playwright action executor (+ element signatures)
│  ├─ navigate.mjs      reachGoal — cached route replay over Computer Use
│  ├─ routes.mjs        learned navigation routes
│  ├─ onboard.mjs       learn main → product memory
│  ├─ review.mjs        PR review: contract replay + Pass-2 visual diff + scope
│  ├─ code-review.mjs   remote managed-agent code-side review
│  ├─ merge.mjs         merge-on-merge: graduate accepted knowledge into main
│  ├─ github-review.mjs review a real GitHub PR + post a comment
│  └─ run-stream.mjs    NDJSON event stream for the live cockpit
├─ app/                 Next.js cockpit (evidence viewer + SSE)
├─ lib/                 server-side memory reader
└─ .autoqa/             file-based product memory (screens, contracts, screenshots, routes, reports)
```

---

## Memory format

Everything the agent learns is plain files — easy to inspect, diff, and visualize:

```
.autoqa/
├─ main/
│  ├─ screens.json          discovered screens + descriptions
│  ├─ behaviors/            behavior contracts (expected outcomes)
│  ├─ skills/               how-to-test notes
│  └─ routes/               cached Computer Use action routes
├─ screenshots/
│  ├─ main/                 current baselines
│  └─ <merged-branch>/      visual history per merged branch
└─ prs/<id>/                per-PR screenshots, comparison, and report
```

---

<sub>Built at the **2026 AI Engineer World's Fair Hackathon** (Cerebral Valley, San Francisco). Continual Learning · The Self-Improvement Stack.</sub>
