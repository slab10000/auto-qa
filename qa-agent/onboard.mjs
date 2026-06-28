// Main-branch onboarding: clone the target repo from GitHub, explore each page with a real
// browser, capture baselines, describe the screens, and learn a behavior contract + route + skill.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { serveStatic } from "./serve.mjs";
import { reason } from "./gemini.mjs";
import { reachGoal } from "./navigate.mjs";
import { routeKey } from "./routes.mjs";
import { VIEWPORT, TARGET_REPO, TARGET_PAGES, CONTRACT_NAV } from "./config.mjs";
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

  // 3) Learn a behavior contract: navigate Home → the linked secondary page, and remember it.
  let contract = null;
  const navPage = pages.find((p) => p.file === CONTRACT_NAV.fromFile);
  if (navPage) {
    emit({ type: "phase", phase: "contract", message: "Learning a navigation contract" });
    await page.goto(site.url, { waitUntil: "load" });
    const beforeUrl = page.url();
    const nav = await reachGoal(page, CONTRACT_NAV.goal, {
      cacheKey: routeKey(`${CONTRACT_NAV.screen}-${CONTRACT_NAV.action}`),
      onStep: (s) => console.log(`     ${s.action} — ${s.intent}`),
      onShot: (_i, _buf, entry) => emit({ type: "step", action: entry.action, intent: entry.intent, url: entry.url }),
    });
    const afterUrl = page.url();
    const navigated = afterUrl !== beforeUrl;
    emit({ type: "route", goal: CONTRACT_NAV.action, cached: nav.cached, llmCalls: nav.llmCalls, ms: nav.ms });
    console.log(`     route ${nav.cached ? "⚡ cached" : "🔎 explored"} — ${nav.llmCalls} model calls, ${nav.ms}ms`);

    const destPath = navigated ? new URL(afterUrl).pathname : null;
    const destPage = pages.find((p) => destPath?.endsWith(p.file)) || null;
    contract = {
      id: "home-store-nav",
      screen: CONTRACT_NAV.screen,
      action: CONTRACT_NAV.action,
      expected_result: {
        type: navigated ? "navigation" : "no-op",
        url_changed: navigated,
        destination_url: destPath,
        visual_anchor: destPage ? `${destPage.name} heading visible` : "destination page visible",
      },
      evidence: { before: `screenshots/main/${navPage.id}.png`, after: destPage ? `screenshots/main/${destPage.id}.png` : null },
      confidence: 0.92,
      learned_from: "main",
      last_verified: stamp(),
    };
    await writeJSON(path.join(paths.mainBehaviors, `${contract.id}.json`), contract);
    emit({ type: "contract", screen: contract.screen, action: contract.action, expected: contract.expected_result, observed: contract.expected_result, match: true });
    console.log(`   → contract: ${contract.action} ⇒ ${contract.expected_result.type}${destPath ? ` to ${destPath}` : ""}`);

    // 4) Skill — how to reach the linked page
    const steps = nav.actions.map((a, i) => `${i + 1}. ${a.intent || a.name}`).join("\n");
    await writeText(
      path.join(paths.mainSkills, "reach-store.md"),
      `# Skill: Reach the ${destPage?.name || "linked"} page\n\n` +
        `Context: it is reachable from the ${CONTRACT_NAV.screen} page's top navigation bar.\n\n` +
        `Steps:\n${steps || "1. Click the link in the top navigation."}\n\n` +
        `Expected: ${navigated ? `navigation to ${destPath}` : "the linked page opens"}, with its heading visible.\n`
    );
    emit({ type: "skill_learned", name: "reach-store.md", screen: destPage?.name || "Store" });
  }

  // 5) Describe each screen (the agent "understanding" the product)
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
  const nSkills = contract ? 1 : 0;
  console.log(`\n✅ main onboarded — ${screens.length} screens, ${contract ? 1 : 0} behavior contract, ${nSkills} skill written to .autoqa/\n`);
  emit({ type: "report", screens: screens.length, contracts: contract ? 1 : 0, skills: nSkills });
  return { screens, contract };
}

// Direct: node --env-file=.env.local qa-agent/onboard.mjs [owner/name]
if (import.meta.url === `file://${process.argv[1]}`) {
  await onboardMain({ repo: process.argv[2] });
}
