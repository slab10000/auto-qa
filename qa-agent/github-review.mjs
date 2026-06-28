// Generic GitHub PR review: works on any multi-page static app.
// Computer Use captures each page (main vs PR), Pass 2 visual-diffs them, a remote managed
// agent reviews the diff, scope is analyzed, and the verdict is posted as a PR comment.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serveStatic } from "./serve.mjs";
import { reason } from "./gemini.mjs";
import { reachGoal } from "./navigate.mjs";
import { routeKey } from "./routes.mjs";
import { remoteReview } from "./code-review.mjs";
import { publishEvidence } from "./evidence.mjs";
import { VIEWPORT, navGoal } from "./config.mjs";
import { AUTOQA, paths, readJSON, writePng } from "./memory.mjs";

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

export async function githubReview(repo, prNumber, { onEvent, post = true, resumeFrom } = {}) {
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

  // Kick off the remote managed agent concurrently: it clones the repo URL, RUNS the
  // app to verify it boots, and reviews the diff — all in its own remote sandbox.
  const codeReviewPromise = remoteReview(
    { repo, prNumber, title: pr.title, body: pr.body, baseRef: pr.baseRefName, headRef: pr.headRefName },
    { onEvent: emit, resumeFrom }
  ).catch((e) => ({
    ran_ok: null, run_method: "unknown", run_evidence: `remote review unavailable: ${e?.message || e}`,
    scope_match: "unclear", risk: "unknown", summary: `remote review unavailable: ${e?.message || e}`, concerns: [],
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

  // 3) Capture the PR. Reach each page by REPLAYING the cached route the agent learned on main
  // (0 model calls when the nav is unchanged); fall back to fresh Computer Use only if it changed.
  // Each frame is streamed to disk so the cockpit's live sandbox shows the real screens.
  git(["checkout", "-q", pr.headRefName], repoDir);
  site = await serveStatic(repoDir);
  emit({ type: "phase", phase: "capture", message: "Replaying learned routes on the PR build" });
  const headBuf = {};
  const slug = repo.replace("/", "__");
  const runDir = path.join(workDir, "run");
  mkdirSync(runDir, { recursive: true });
  let liveN = 0;
  const streamFrame = (entry, buf, cached) => {
    const k = ++liveN;
    const rel = `gh/${slug}/pr-${prNumber}/run/${k}.png`;
    if (buf) writeFileSync(path.join(AUTOQA, rel), buf);
    emit({ type: "step", action: entry.action, intent: entry.intent, url: entry.url, shot: buf ? rel : undefined, cached: !!cached });
  };
  const routeStats = [];
  const behaviorChecks = [];
  for (const f of pages) {
    const name = nameFor(f);
    await page.goto(site.url, { waitUntil: "load" }); // start from Home; the nav is on every page
    if (f === "index.html") {
      streamFrame({ action: "goto", intent: "Open the Home page", url: page.url() }, await page.screenshot(), false);
    } else {
      const goal = navGoal(name);
      const nav = await reachGoal(page, goal, {
        cacheKey: routeKey(goal),
        onShot: (_i, buf, entry) => streamFrame(entry, buf, entry.cached),
      });
      routeStats.push({ page: name, cached: nav.cached, llmCalls: nav.llmCalls, ms: nav.ms });
      emit({ type: "route", goal: name, cached: nav.cached, llmCalls: nav.llmCalls, ms: nav.ms });
      console.log(`   ${name}: ${nav.cached ? "⚡ cached (0 calls)" : `🔎 explored (${nav.llmCalls} calls)`} ${nav.ms}ms`);

      // Behavior contract replay: did clicking that nav still NAVIGATE to the expected page,
      // or did the button's behavior change (e.g. it now opens a modal / does nothing)?
      const contract = await readJSON(path.join(paths.mainBehaviors, `home-nav-${name.toLowerCase()}.json`), null);
      if (contract) {
        const navigated = page.url().endsWith(f); // observed BEFORE the safety fallback below
        const observed = navigated
          ? { type: "navigation", url_changed: true, destination_url: new URL(page.url()).pathname }
          : { type: "no-navigation", url_changed: false, destination_url: null };
        const match = navigated && contract.expected_result?.type === "navigation";
        behaviorChecks.push({ contract_id: contract.id, screen: name, action: contract.action, expected: contract.expected_result, observed, match });
        emit({ type: "contract", screen: name, action: contract.action, expected: contract.expected_result, observed, match });
        if (!match) console.log(`   ⚠ ${name}: nav contract MISMATCH — expected navigation → ${contract.expected_result?.destination_url}, observed ${page.url()}`);
      }
    }
    if (f !== "index.html" && !page.url().endsWith(f)) await page.goto(`${site.url}/${f}`, { waitUntil: "load" }); // safety
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    headBuf[f] = await page.screenshot();
    await writePng(path.join(shotDir("head"), `${f}.png`), headBuf[f]);
    streamFrame({ action: "captured", intent: `Captured the ${name} page`, url: `${site.url}/${f}` }, headBuf[f], false);
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

  // The visual + scope work is done; the only thing left is the remote managed-agent code review,
  // which can sit silently for a while. Tell the cockpit so it shows progress, not a frozen frame.
  emit({ type: "phase", phase: "code-review-wait", message: "Reviewing code in the managed-agent sandbox…" });
  const code_review = await codeReviewPromise;

  // 5b) Publish before/after screenshots for the screens that visibly changed, so the comment can
  // embed them (GitHub can't inline local files). Only when we're posting — best-effort.
  let evidenceUrls = {};
  if (post) {
    const changedScreens = comparisons.filter((c) => c.changed).map((c) => ({ name: c.page, file: c.file }));
    if (changedScreens.length) {
      emit({ type: "phase", phase: "evidence", message: `Publishing before/after images for ${changedScreens.length} changed screen(s)` });
      const headSha = git(["rev-parse", `origin/${pr.headRefName}`], repoDir).trim();
      evidenceUrls = await publishEvidence({
        repo, prNumber, slug, sha: headSha, changedScreens,
        shotPath: (side, file) => path.join(workDir, side, `${file}.png`),
        onEvent: emit,
      });
    }
  }

  // 6) Compose the comment, then post it. When AUTOQA_BOT_TOKEN is configured, local gh
  // receives it as GH_TOKEN so GitHub authors the comment as that token's account.
  // Keep this local: do not ship the token to the remote managed-agent sandbox.
  const body = renderComment(pr, scope, comparisons, code_review, changedFiles, evidenceUrls);
  let posted = null;
  if (post) {
    const tmp = path.join(workDir, "comment.md");
    writeFileSync(tmp, body);
    const botToken = process.env.AUTOQA_BOT_TOKEN;
    if (botToken) {
      execFileSync("gh", ["pr", "comment", String(prNumber), "-R", repo, "--body-file", tmp], {
        encoding: "utf8",
        env: { ...process.env, GH_TOKEN: botToken },
      });
      posted = pr.url;
      console.log(`💬 posted review to ${pr.url} (local gh as AUTOQA_BOT_TOKEN account)`);
    } else {
      gh(["pr", "comment", String(prNumber), "-R", repo, "--body-file", tmp]);
      posted = pr.url;
      console.log(`💬 posted review to ${pr.url} (local gh — set AUTOQA_BOT_TOKEN to post every comment as your bot)`);
    }
  }
  emit({ type: "report", verdict: scope.verdict, classification: scope.classification, url: pr.url, posted });
  return { pr, scope, comparisons, code_review, changedFiles, body, posted, routeStats, behaviorChecks };
}

function renderComment(pr, scope, comparisons, cr, changedFiles, evidenceUrls = {}) {
  const emoji = scope.verdict === "FAIL" ? "🔴" : scope.verdict === "WARN" ? "🟡" : "🟢";
  const vis = comparisons
    .map((c) => `- **${c.page}** — ${c.changed ? `changed (${c.severity}): ${c.summary}` : "no change"}`)
    .join("\n");
  // Embed before/after screenshots for the screens that changed (when we managed to host them).
  const shots = comparisons
    .filter((c) => c.changed && evidenceUrls[c.page])
    .map((c) => {
      const u = evidenceUrls[c.page];
      return `<details><summary>📸 <b>${c.page}</b> — before / after</summary>

<table>
<tr><td align="center"><sub>main (before)</sub></td><td align="center"><sub>PR (after)</sub></td></tr>
<tr><td><img width="400" src="${u.before}" alt="${c.page} before"></td><td><img width="400" src="${u.after}" alt="${c.page} after"></td></tr>
</table>

</details>`;
    })
    .join("\n");
  const list = (xs) => (xs && xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- —");
  const concerns = (cr.concerns || []).map((x) => `- ${x}`).join("\n");
  const runIcon = cr.ran_ok === true ? "✅" : cr.ran_ok === false ? "❌" : "❔";
  const runState = cr.ran_ok === true ? "App boots" : cr.ran_ok === false ? "App did NOT run cleanly" : "Run status unknown";
  const runLine = `${runIcon} **${runState}**${cr.run_method ? ` · ${cr.run_method}` : ""}${cr.run_evidence ? `\n\n${cr.run_evidence}` : ""}`;
  return `## ${emoji} auto-qa review — **${scope.verdict}** · ${scope.classification}

> Stated scope: _${pr.title}_

${scope.reasoning}

### 👁️ Visual behavior — Computer Use captured each page (main vs PR)
${vis}
${shots ? `\n${shots}\n` : ""}
### 🚀 Did it run? — remote sandbox cloned & launched the PR build
${runLine}

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
