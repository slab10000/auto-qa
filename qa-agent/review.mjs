// PR review: clone the branch, replay behavior contracts (Pass 1), compare screens visually (Pass 2),
// reason about scope, and write a report. Emits live events via opts.onEvent for the cockpit stream.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { serveStatic } from "./serve.mjs";
import { runGoal, reason } from "./gemini.mjs";
import { reachGoal } from "./navigate.mjs";
import { routeKey } from "./routes.mjs";
import { codeReview } from "./code-review.mjs";
import { VIEWPORT } from "./config.mjs";
import { ROOT, AUTOQA, paths, readJSON, writeJSON, writeText, writePng } from "./memory.mjs";

const stamp = () => new Date().toISOString();
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" });

// Demo PR metadata — STATED scope is billing only (the Settings change is undocumented).
// In production this comes from the GitHub PR API.
const PR_FIXTURES = {
  "pr-1": {
    id: "pr-1",
    number: 1,
    title: "Update billing copy",
    description:
      "Refresh the Free plan copy on the Billing page so it's clearer about what upgrading unlocks.",
    branch: "pr-1-billing-copy",
    base: "main",
  },
};

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

export async function reviewPR(prId = "pr-1", { onEvent } = {}) {
  const emit = onEvent || (() => {});
  const pr = PR_FIXTURES[prId];
  if (!pr) throw new Error(`unknown PR '${prId}'`);

  console.log(`\n🔬 Reviewing ${prId}: "${pr.title}"`);
  emit({ type: "phase", phase: "start", pr });

  // 1) Clone the target repo + checkout the PR branch (agent works off its own clone)
  const sampleRepo = path.join(ROOT, "sample-app");
  const repoDir = path.join(paths.prDir(prId), "repo");
  emit({ type: "phase", phase: "clone", message: `Cloning ${pr.branch}…` });
  if (existsSync(repoDir)) rmSync(repoDir, { recursive: true, force: true });
  git(["clone", "-q", sampleRepo, repoDir]);
  git(["checkout", "-q", pr.branch], repoDir);
  const diff = git(["diff", pr.base, pr.branch], repoDir);
  const changedFiles = git(["diff", "--name-only", pr.base, pr.branch], repoDir)
    .trim().split("\n").filter(Boolean);
  console.log(`   changed files: ${changedFiles.join(", ")}`);
  emit({ type: "phase", phase: "analyze", message: "Analyzing diff", changed: changedFiles });

  // Kick off the remote managed-agent code-side review concurrently with the browser pass.
  const codeReviewPromise = codeReview(pr, diff, changedFiles, { onEvent: emit }).catch((e) => ({
    scope_match: "unclear", risk: "unknown",
    summary: `code review unavailable: ${e?.message || e}`, concerns: [],
  }));

  // Live-run screenshot dir (streamed step-by-step to the cockpit)
  const runDir = path.join(paths.prDir(prId), "run");
  if (existsSync(runDir)) rmSync(runDir, { recursive: true, force: true });
  mkdirSync(runDir, { recursive: true });
  let stepN = 0;
  const streamShot = (entry, buf) => {
    const n = ++stepN;
    const rel = `prs/${prId}/run/${n}.png`;
    writeFileSync(path.join(AUTOQA, rel), buf);
    emit({ type: "step", n, action: entry.action, intent: entry.intent, url: entry.url, shot: rel });
  };

  // 2) Load what main taught us
  const contract = await readJSON(path.join(paths.mainBehaviors, "dashboard-settings-entry.json"));

  // 3) Pass 1 — capture the PR's screens + replay the contract
  const site = await serveStatic(repoDir);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);
  const prShot = async (id) => {
    const buf = await page.screenshot();
    await writePng(path.join(paths.prScreens(prId), `${id}.png`), buf);
    return buf;
  };

  console.log("• Pass 1: capturing PR screens + replaying contract");
  emit({ type: "phase", phase: "replay", message: "Driving the app with Computer Use" });
  await page.goto(site.url, { waitUntil: "load" });
  const dashBuf = await prShot("dashboard");
  streamShot({ action: "goto", intent: "Open the Dashboard", url: page.url() }, dashBuf);

  const beforeUrl = page.url();
  const nav = await reachGoal(page, `${contract.action} on the ${contract.screen}.`, {
    cacheKey: routeKey(`${contract.screen}-${contract.action}`),
    onStep: (s) => console.log(`    ${s.action} — ${s.intent}${s.cached ? " (cached)" : ""}`),
    onShot: (_i, buf, entry) => streamShot(entry, buf),
  });
  const afterUrl = page.url();
  emit({ type: "route", goal: contract.action, cached: nav.cached, llmCalls: nav.llmCalls, ms: nav.ms });
  console.log(`    route: ${nav.cached ? `⚡ cached — 0 model calls, ${nav.ms}ms` : `🔎 explored — ${nav.llmCalls} model calls, ${nav.ms}ms`}`);
  const settingsBuf = await prShot("settings");
  const observed = {
    type: afterUrl !== beforeUrl ? "navigation" : "modal",
    url_changed: afterUrl !== beforeUrl,
    destination_url: afterUrl !== beforeUrl ? new URL(afterUrl).pathname : null,
  };
  const behaviorMatch = observed.type === contract.expected_result.type;
  console.log(`    contract: expected ${contract.expected_result.type}, observed ${observed.type} → ${behaviorMatch ? "✅ match" : "❌ MISMATCH"}`);
  emit({
    type: "contract",
    screen: contract.screen, action: contract.action,
    expected: contract.expected_result, observed, match: behaviorMatch,
  });

  // Self-improvement: write a PR-specific skill capturing how to test the changed behavior.
  await writeText(
    path.join(paths.prDir(prId), "skills", "verify-settings.md"),
    `# Skill: Verify Settings behavior (${pr.branch})\n\n` +
      `On this branch, clicking the ⚙ Settings button on the Dashboard results in a **${observed.type}**` +
      `${observed.destination_url ? ` to ${observed.destination_url}` : " (the URL does not change)"}.\n\n` +
      `To verify:\n1. Open the Dashboard.\n2. Click the ⚙ Settings button.\n` +
      `3. Expect ${observed.type === "modal" ? 'a modal dialog titled "Settings" to appear over the dashboard' : `navigation to ${observed.destination_url}`}.\n` +
      `4. Capture a screenshot as evidence.\n`
  );
  emit({ type: "skill_learned", name: "verify-settings.md", screen: "Settings" });

  await page.goto(site.url, { waitUntil: "load" });
  await runGoal(page, "Open the Billing screen.", {
    onShot: (_i, buf, entry) => streamShot(entry, buf),
  });
  const billingBuf = await prShot("billing");

  await browser.close();
  await site.close();

  // 4) Pass 2 — visual comparison, main baseline vs PR, per screen
  console.log("• Pass 2: comparing screens (main vs PR)");
  emit({ type: "phase", phase: "compare", message: "Comparing screens against main baseline" });
  const baseline = (id) => readFile(path.join(paths.screenshots("main"), `${id}.png`));
  const compareScreen = async (id, prBuf) => {
    const txt = await reason(
      `Two screenshots of the "${id}" screen of a web app. The FIRST is the accepted main baseline; ` +
      `the SECOND is the PR version. Reply ONLY with JSON: ` +
      `{"changed": boolean, "summary": string, "severity": "none|low|medium|high"}.`,
      [await baseline(id), prBuf]
    );
    const parsed = parseJSON(txt, { changed: null, summary: txt, severity: "unknown" });
    console.log(`    ${id}: ${parsed.changed ? `changed (${parsed.severity})` : "no change"}`);
    const result = { screen: id, ...parsed };
    emit({ type: "comparison", ...result });
    return result;
  };
  const comparisons = [
    await compareScreen("dashboard", dashBuf),
    await compareScreen("settings", settingsBuf),
    await compareScreen("billing", billingBuf),
  ];

  // 5) Scope analysis — does the PR's stated intent explain what changed?
  console.log("• Scope analysis");
  emit({ type: "phase", phase: "scope", message: "Reasoning about PR scope" });
  const scopeTxt = await reason(
    `You are a senior QA reviewer. A pull request has this STATED scope:\n` +
    `Title: ${pr.title}\nDescription: ${pr.description}\n\n` +
    `Changed files: ${changedFiles.join(", ")}\n\nDiff:\n${diff}\n\n` +
    `A behavioral test found: clicking the Settings button on the Dashboard used to ` +
    `${contract.expected_result.type === "navigation" ? `navigate to ${contract.expected_result.destination_url}` : "open a modal"}, ` +
    `but in this PR it now ${observed.type === "navigation" ? `navigates to ${observed.destination_url}` : "opens a modal without changing the URL"}.\n\n` +
    `Classify each observed change as in-scope or out-of-scope for the STATED intent. ` +
    `Reply ONLY with JSON: {"verdict":"PASS|WARN|FAIL","classification":"expected|suspicious|regression|needs_review",` +
    `"in_scope":[string],"out_of_scope":[string],"reasoning":string}.`
  );
  const scope = parseJSON(scopeTxt, {
    verdict: behaviorMatch ? "PASS" : "FAIL",
    classification: behaviorMatch ? "expected" : "suspicious",
    in_scope: [], out_of_scope: [], reasoning: scopeTxt,
  });
  emit({ type: "scope", ...scope });

  // Wait for the concurrent managed-agent code-side review
  const code_review = await codeReviewPromise;

  // 6) Report
  const report = {
    pr,
    generated_at: stamp(),
    verdict: scope.verdict,
    behavior_checks: [
      {
        contract_id: contract.id,
        screen: contract.screen,
        action: contract.action,
        expected: contract.expected_result,
        observed,
        match: behaviorMatch,
      },
    ],
    visual_comparisons: comparisons,
    scope_analysis: scope,
    code_review,
    route_metrics: { cached: nav.cached, llmCalls: nav.llmCalls, ms: nav.ms },
    changed_files: changedFiles,
    evidence: {
      main: { dashboard: "screenshots/main/dashboard.png", settings: "screenshots/main/settings.png", billing: "screenshots/main/billing.png" },
      pr: {
        dashboard: `prs/${prId}/screenshots/dashboard.png`,
        settings: `prs/${prId}/screenshots/settings.png`,
        billing: `prs/${prId}/screenshots/billing.png`,
      },
    },
  };
  await writeJSON(paths.prReport(prId), report);
  await writeText(paths.prComparison(prId), renderMd(report));

  console.log(`\n🧾 Verdict: ${report.verdict} — ${scope.classification}`);
  emit({ type: "report", prId, verdict: report.verdict, classification: scope.classification });
  return report;
}

function renderMd(r) {
  const bc = r.behavior_checks[0];
  const cmp = (c) => `- **${c.screen}** — ${c.changed ? `changed (${c.severity})` : "no change"}: ${c.summary}`;
  return `# PR Review: ${r.pr.title} (${r.pr.id})

**Verdict: ${r.verdict}** — ${r.scope_analysis.classification}

## Behavior contract replay
- Action: ${bc.action} on ${bc.screen}
- Main (expected): ${bc.expected.type}${bc.expected.destination_url ? ` → ${bc.expected.destination_url}` : ""}
- PR (observed): ${bc.observed.type}${bc.observed.destination_url ? ` → ${bc.observed.destination_url}` : ""}
- Result: ${bc.match ? "✅ match" : "❌ MISMATCH"}

## Visual comparison (main vs PR)
${r.visual_comparisons.map(cmp).join("\n")}

## Scope analysis
${r.scope_analysis.reasoning}

- **In scope:** ${(r.scope_analysis.in_scope || []).join("; ") || "—"}
- **Out of scope:** ${(r.scope_analysis.out_of_scope || []).join("; ") || "—"}

## Changed files
${r.changed_files.map((f) => `- ${f}`).join("\n")}
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await reviewPR(process.argv[2] || "pr-1");
}
