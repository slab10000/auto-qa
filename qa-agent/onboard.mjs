// Main-branch onboarding: clone the target repo from GitHub, explore each page with a real
// browser, capture baselines, describe the screens, and learn how to NAVIGATE the whole app —
// a cached route + skill + behavior contract for every page reachable from the top nav. Reviews
// then replay those routes with 0 model calls instead of re-driving with Computer Use each time.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serveStatic } from "./serve.mjs";
import { reason } from "./gemini.mjs";
import { reachGoal } from "./navigate.mjs";
import { routeKey } from "./routes.mjs";
import { VIEWPORT, TARGET_REPO, TARGET_PAGES, navGoal } from "./config.mjs";
import { AUTOQA, paths, writeJSON, writeText, writePng } from "./memory.mjs";

const stamp = () => new Date().toISOString();
const gh = (args) => execFileSync("gh", args, { encoding: "utf8" });

export async function onboardMain({ repo = TARGET_REPO, onEvent } = {}) {
  const emit = onEvent || (() => {});
  console.log(`\n🧭 Onboarding main of ${repo} (cloned from GitHub)`);
  emit({ type: "phase", phase: "start", repo });

  // 1) Clone the repo's default branch into gitignored .autoqa/main/repo
  const repoDir = path.join(paths.mainDir, "repo");
  emit({ type: "phase", phase: "clone", message: `Cloning ${repo}` });
  if (existsSync(repoDir)) rmSync(repoDir, { recursive: true, force: true });
  mkdirSync(path.dirname(repoDir), { recursive: true });
  gh(["repo", "clone", repo, repoDir, "--", "-q"]);

  const site = await serveStatic(repoDir);
  console.log(`   serving at ${site.url}`);
  const pages = TARGET_PAGES.filter((p) => existsSync(path.join(repoDir, p.file)));
  console.log(`   pages: ${pages.map((p) => p.name).join(", ")}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  // 2) Capture a clean baseline of every page
  emit({ type: "phase", phase: "explore", message: "Exploring the app like a new QA engineer" });
  const captured = [];
  for (const p of pages) {
    const url = p.file === "index.html" ? "/" : `/${p.file}`;
    await page.goto(`${site.url}${url}`, { waitUntil: "load" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const buf = await page.screenshot();
    const rel = `screenshots/main/${p.id}.png`;
    await writePng(path.join(AUTOQA, rel), buf);
    captured.push({ ...p, url, buf, rel });
    console.log(`   • ${p.name} (${url})`);
    emit({ type: "step", action: "capture", intent: `Capture the ${p.name} page`, url, shot: rel });
  }

  // 3) Learn how to reach every page from the top nav: cache a route + write a skill + contract.
  const homePage = pages.find((p) => p.file === "index.html") || pages[0];
  const secondary = pages.filter((p) => p.id !== homePage.id);
  const contracts = [];
  const skills = [];
  for (const dest of secondary) {
    emit({ type: "phase", phase: "contract", message: `Learning how to reach ${dest.name}` });
    await page.goto(site.url, { waitUntil: "load" });
    const beforeUrl = page.url();
    const goal = navGoal(dest.name);
    const nav = await reachGoal(page, goal, {
      cacheKey: routeKey(goal),
      onStep: (s) => console.log(`     ${s.action} — ${s.intent}${s.cached ? " (cached)" : ""}`),
      onShot: (_i, _buf, entry) => emit({ type: "step", action: entry.action, intent: entry.intent, url: entry.url }),
    });
    const afterUrl = page.url();
    const navigated = afterUrl !== beforeUrl;
    const destPath = navigated ? new URL(afterUrl).pathname : null;
    emit({ type: "route", goal: dest.name, cached: nav.cached, llmCalls: nav.llmCalls, ms: nav.ms });
    console.log(
      `   → ${dest.name}: ${nav.cached ? "⚡ cached" : "🔎 explored"} (${nav.llmCalls} calls, ${nav.ms}ms) ⇒ ${destPath || "no-op"}`
    );

    const contract = {
      id: `home-nav-${dest.id}`,
      screen: homePage.name,
      action: `Click "${dest.name}" in the top nav`,
      expected_result: {
        type: navigated ? "navigation" : "no-op",
        url_changed: navigated,
        destination_url: destPath,
        visual_anchor: `${dest.name} heading visible`,
      },
      evidence: { before: `screenshots/main/${homePage.id}.png`, after: `screenshots/main/${dest.id}.png` },
      confidence: 0.92,
      learned_from: "main",
      last_verified: stamp(),
    };
    await writeJSON(path.join(paths.mainBehaviors, `${contract.id}.json`), contract);
    contracts.push(contract);

    const steps = nav.actions.map((a, i) => `${i + 1}. ${a.intent || a.name}`).join("\n");
    const skillName = `reach-${dest.id}.md`;
    await writeText(
      path.join(paths.mainSkills, skillName),
      `# Skill: Reach the ${dest.name} page\n\n` +
        `Context: the ${dest.name} page is reachable from the top navigation bar (on every screen).\n\n` +
        `Steps:\n${steps || "1. Click the link in the top navigation bar."}\n\n` +
        `Expected: ${navigated ? `navigation to ${destPath}` : "the page opens"}, with the "${dest.name}" heading visible.\n`
    );
    skills.push(skillName);
    emit({ type: "skill_learned", name: skillName, screen: dest.name });
  }

  // 4) Describe each screen (the agent "understanding" the product)
  emit({ type: "phase", phase: "describe", message: "Describing the learned screens" });
  const screens = [];
  for (const c of captured) {
    const purpose = await reason(
      "In one short sentence, name this screen of a web app and say what it is for. Reply with just the sentence.",
      [c.buf]
    );
    screens.push({ id: c.id, name: c.name, url: c.url, purpose, screenshot: c.rel });
    console.log(`   ${c.name}: ${purpose}`);
  }
  await writeJSON(paths.mainScreens, { learned_from: "main", repo, learned_at: stamp(), screens });

  await browser.close();
  await site.close();
  console.log(
    `\n✅ main onboarded — ${screens.length} screens, ${contracts.length} behavior contracts, ${skills.length} skills, ${secondary.length} cached routes written to .autoqa/\n`
  );
  emit({ type: "report", screens: screens.length, contracts: contracts.length, skills: skills.length, routes: secondary.length });
  return { screens, contracts, skills };
}

// Direct: node --env-file=.env.local qa-agent/onboard.mjs [owner/name]
if (import.meta.url === `file://${process.argv[1]}`) {
  await onboardMain({ repo: process.argv[2] });
  process.stdout.write("", () => process.exit(0));
}
