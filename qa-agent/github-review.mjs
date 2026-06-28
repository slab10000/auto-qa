// Generic GitHub PR review: works on any multi-page static app.
// Computer Use captures each page (main vs PR), Pass 2 visual-diffs them, a remote managed
// agent reviews the diff, scope is analyzed, and the verdict is posted as a PR comment.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serveStatic } from "./serve.mjs";
import { runGoal, reason } from "./gemini.mjs";
import { codeReview } from "./code-review.mjs";
import { VIEWPORT } from "./config.mjs";
import { AUTOQA, writePng } from "./memory.mjs";

const gh = (args) => execFileSync("gh", args, { encoding: "utf8" });
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" });

// Friendly names for known pages; any other *.html is captured with a title-cased name.
const PAGE_NAMES = {
  "index.html": "Home", "products.html": "Store", "dashboard.html": "Dashboard",
  "tasks.html": "Tasks", "contact.html": "Contact",
};
const nameFor = (f) => PAGE_NAMES[f] || f.replace(/\.html$/, "").replace(/^\w/, (c) => c.toUpperCase());

function parseJSON(text, fallback) {
  if (!text) return fallback;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  try { return JSON.parse(raw); } catch {
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s >= 0 && e > s) { try { return JSON.parse(raw.slice(s, e + 1)); } catch {} }
    return fallback;
  }
}

export async function githubReview(repo, prNumber, { onEvent, post = true } = {}) {
  const emit = onEvent || (() => {});
  const pr = JSON.parse(
    gh(["pr", "view", String(prNumber), "-R", repo, "--json", "number,title,body,headRefName,baseRefName,url"])
  );
  console.log(`\n🔬 GitHub review ${repo} #${pr.number} — "${pr.title}"`);
  emit({ type: "phase", phase: "start", pr });

  // 1) Clone + fetch both refs, compute the diff
  const workDir = path.join(AUTOQA, "gh", repo.replace("/", "__"), `pr-${prNumber}`);
  const repoDir = path.join(workDir, "repo");
  if (existsSync(repoDir)) rmSync(repoDir, { recursive: true, force: true });
  mkdirSync(path.dirname(repoDir), { recursive: true });
  emit({ type: "phase", phase: "clone", message: `Cloning ${repo}` });
  gh(["repo", "clone", repo, repoDir, "--", "-q"]);
  git(["fetch", "-q", "origin", pr.baseRefName, pr.headRefName], repoDir);
  const range = `origin/${pr.baseRefName}...origin/${pr.headRefName}`;
  const diff = git(["diff", range], repoDir);
  const changedFiles = git(["diff", "--name-only", range], repoDir).trim().split("\n").filter(Boolean);
  console.log("   changed:", changedFiles.join(", "));
  emit({ type: "phase", phase: "analyze", message: "Analyzing diff", changed: changedFiles });

  // Kick off the remote managed-agent code review concurrently
  const codeReviewPromise = codeReview(pr, diff, changedFiles, { onEvent: emit }).catch((e) => ({
    scope_match: "unclear", risk: "unknown", summary: `code review unavailable: ${e?.message || e}`, concerns: [],
  }));

  const pages = Object.keys(PAGE_NAMES).filter((f) => existsSync(path.join(repoDir, f)));
  const shotDir = (side) => path.join(workDir, side);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  // 2) Capture base baselines (direct, identical framing for clean diffs)
  git(["checkout", "-q", pr.baseRefName], repoDir);
  let site = await serveStatic(repoDir);
  const baseBuf = {};
  for (const f of pages) {
    await page.goto(`${site.url}/${f}`, { waitUntil: "load" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    baseBuf[f] = await page.screenshot();
    await writePng(path.join(shotDir("base"), `${f}.png`), baseBuf[f]);
  }
  await site.close();

  // 3) Capture the PR with Computer Use driving the navigation
  git(["checkout", "-q", pr.headRefName], repoDir);
  site = await serveStatic(repoDir);
  emit({ type: "phase", phase: "capture", message: "Computer Use exploring the PR build" });
  await page.goto(site.url, { waitUntil: "load" });
  const headBuf = {};
  for (const f of pages) {
    const name = nameFor(f);
    await runGoal(page, `Open the ${name} page using the top navigation bar.`, {
      maxSteps: 4,
      onShot: (_i, _buf, entry) => emit({ type: "step", action: entry.action, intent: entry.intent, url: entry.url }),
    });
    if (!page.url().endsWith(f)) await page.goto(`${site.url}/${f}`, { waitUntil: "load" }); // safety fallback
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    headBuf[f] = await page.screenshot();
    await writePng(path.join(shotDir("head"), `${f}.png`), headBuf[f]);
  }
  await browser.close();
  await site.close();

  // 4) Pass 2 — visual diff per page
  emit({ type: "phase", phase: "compare", message: "Comparing pages (main vs PR)" });
  const comparisons = [];
  for (const f of pages) {
    const name = nameFor(f);
    const txt = await reason(
      `Two screenshots of the "${name}" page of a web app. The FIRST is the accepted main baseline; ` +
      `the SECOND is the PR version. Reply ONLY with JSON: ` +
      `{"changed": boolean, "summary": string, "severity": "none|low|medium|high"}.`,
      [baseBuf[f], headBuf[f]]
    );
    const parsed = parseJSON(txt, { changed: null, summary: txt, severity: "unknown" });
    comparisons.push({ page: name, file: f, ...parsed });
    console.log(`   ${name}: ${parsed.changed ? `changed (${parsed.severity})` : "no change"}`);
    emit({ type: "comparison", screen: name, ...parsed });
  }

  // 5) Scope analysis
  emit({ type: "phase", phase: "scope", message: "Reasoning about PR scope" });
  const changedVisual = comparisons.filter((c) => c.changed).map((c) => `${c.page}: ${c.summary}`).join("\n") || "none";
  const scopeTxt = await reason(
    `You are a senior QA reviewer. A pull request has this STATED scope:\n` +
    `Title: ${pr.title}\nDescription: ${pr.body}\n\n` +
    `Changed files: ${changedFiles.join(", ")}\n\nDiff:\n${diff}\n\n` +
    `Visual changes observed (main vs PR):\n${changedVisual}\n\n` +
    `Classify each change as in-scope or out-of-scope for the STATED intent. ` +
    `Reply ONLY with JSON: {"verdict":"PASS|WARN|FAIL","classification":"expected|suspicious|regression|needs_review",` +
    `"in_scope":[string],"out_of_scope":[string],"reasoning":string}.`
  );
  const scope = parseJSON(scopeTxt, { verdict: "WARN", classification: "needs_review", in_scope: [], out_of_scope: [], reasoning: scopeTxt });
  emit({ type: "scope", ...scope });

  const code_review = await codeReviewPromise;

  // 6) Compose + post the comment
  const body = renderComment(pr, scope, comparisons, code_review, changedFiles);
  if (post) {
    const tmp = path.join(workDir, "comment.md");
    writeFileSync(tmp, body);
    gh(["pr", "comment", String(prNumber), "-R", repo, "--body-file", tmp]);
    console.log(`💬 posted review to ${pr.url}`);
  }
  emit({ type: "report", verdict: scope.verdict, classification: scope.classification, url: pr.url });
  return { pr, scope, comparisons, code_review, changedFiles, body };
}

function renderComment(pr, scope, comparisons, cr, changedFiles) {
  const emoji = scope.verdict === "FAIL" ? "🔴" : scope.verdict === "WARN" ? "🟡" : "🟢";
  const vis = comparisons
    .map((c) => `- **${c.page}** — ${c.changed ? `changed (${c.severity}): ${c.summary}` : "no change"}`)
    .join("\n");
  const list = (xs) => (xs && xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- —");
  const concerns = (cr.concerns || []).map((x) => `- ${x}`).join("\n");
  return `## ${emoji} auto-qa review — **${scope.verdict}** · ${scope.classification}

> Stated scope: _${pr.title}_

${scope.reasoning}

### 👁️ Visual behavior — Computer Use captured each page (main vs PR)
${vis}

### 🧠 Code-side review — remote managed agent (Antigravity)
**scope:** ${cr.scope_match} · **risk:** ${cr.risk}

${cr.summary}
${concerns ? `\n${concerns}` : ""}

### Scope
**In scope**
${list(scope.in_scope)}

**Out of scope**
${list(scope.out_of_scope)}

### Changed files
${changedFiles.map((f) => `- \`${f}\``).join("\n")}

<sub>🤖 **auto-qa** — a self-improving QA agent · Gemini 3.5 Computer Use (eyes & hands) + Managed Agents (code-side brain)</sub>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await githubReview(process.argv[2] || "slab10000/test-app", process.argv[3] || "1");
}
