// Main-branch onboarding: explore the app, capture baselines, write behavior contracts + skills.
import path from "node:path";
import { chromium } from "playwright";
import { serveStatic } from "./serve.mjs";
import { runGoal, reason } from "./gemini.mjs";
import { reachGoal } from "./navigate.mjs";
import { routeKey } from "./routes.mjs";
import { VIEWPORT } from "./config.mjs";
import { ROOT, paths, writeJSON, writeText, writePng } from "./memory.mjs";

const stamp = () => new Date().toISOString();
const log = (s) => console.log(`    ${s.action} — ${s.intent} → ${s.url}`);

export async function onboardMain(targetDir) {
  const dir = targetDir || path.join(ROOT, "sample-app");
  const site = await serveStatic(dir);
  console.log(`\n🧭 Onboarding main from ${dir}\n   serving at ${site.url}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  const captured = []; // { id, url, buf }
  const shotRel = (id) => `screenshots/main/${id}.png`;
  const saveShot = async (id, url) => {
    const buf = await page.screenshot();
    await writePng(path.join(paths.screenshots("main"), `${id}.png`), buf);
    captured.push({ id, url, buf });
    return buf;
  };

  // 1) Dashboard (home) baseline
  console.log("\n• Capturing Dashboard");
  await page.goto(site.url, { waitUntil: "load" });
  await saveShot("dashboard", "/");

  // 2) Learn the Settings-entry behavior (the contract the PR will be judged on)
  console.log("• Probing Settings entry behavior");
  const beforeUrl = page.url();
  const settingsRun = await reachGoal(page, "Click the Settings button to open settings.", {
    cacheKey: routeKey("Dashboard-Click the Settings button"),
    onStep: log,
  });
  const afterUrl = page.url();
  console.log(`    route ${settingsRun.cached ? "⚡ cached" : "🔎 explored"} — ${settingsRun.llmCalls} model calls, ${settingsRun.ms}ms`);
  await saveShot("settings", new URL(afterUrl).pathname);
  const navigated = afterUrl !== beforeUrl;

  const contract = {
    id: "dashboard-settings-entry",
    screen: "Dashboard",
    action: "Click the Settings button",
    expected_result: {
      type: navigated ? "navigation" : "modal",
      url_changed: navigated,
      destination_url: navigated ? new URL(afterUrl).pathname : null,
      visual_anchor: "Settings heading visible",
    },
    evidence: { before: shotRel("dashboard"), after: shotRel("settings") },
    confidence: 0.92,
    learned_from: "main",
    last_verified: stamp(),
  };
  await writeJSON(path.join(paths.mainBehaviors, `${contract.id}.json`), contract);
  console.log(`    → contract: click Settings ⇒ ${contract.expected_result.type}` +
    (navigated ? ` to ${contract.expected_result.destination_url}` : ""));

  // 3) Billing screen
  console.log("• Capturing Billing");
  await page.goto(site.url, { waitUntil: "load" });
  await runGoal(page, "Open the Billing screen.", { onStep: log });
  await saveShot("billing", new URL(page.url()).pathname);

  // 4) Describe each screen (the agent "understanding" the product)
  console.log("• Describing screens");
  const screens = [];
  for (const s of captured) {
    const purpose = await reason(
      "In one short sentence, name this screen of a web app and say what it is for. Reply with just the sentence.",
      [s.buf]
    );
    screens.push({ id: s.id, name: s.id[0].toUpperCase() + s.id.slice(1), url: s.url, purpose, screenshot: shotRel(s.id) });
    console.log(`    ${s.id}: ${purpose}`);
  }
  await writeJSON(paths.mainScreens, { learned_from: "main", learned_at: stamp(), screens });

  // 5) Skills — the self-improvement artifact (teaching future runs how to test)
  const steps = settingsRun.actions.map((a, i) => `${i + 1}. ${a.intent || a.name}`).join("\n");
  await writeText(
    path.join(paths.mainSkills, "reach-settings.md"),
    `# Skill: Reach the Settings screen\n\n` +
      `Context: The Settings entry point is the "⚙ Settings" button in the top-right toolbar of the Dashboard.\n\n` +
      `Steps:\n${steps}\n\n` +
      `Expected: ${navigated ? `navigation to ${contract.expected_result.destination_url}` : "a Settings modal"}, ` +
      `with the "Settings" heading visible.\n\n` +
      `Known risks:\n- If a modal opens instead of navigating, compare against the PR scope before flagging.\n`
  );

  await browser.close();
  await site.close();
  console.log(`\n✅ main onboarded — ${screens.length} screens, 1 behavior contract, 1 skill written to .autoqa/\n`);
  return { screens, contract };
}

// Allow direct execution: node --env-file=.env.local qa-agent/onboard.mjs [targetDir]
if (import.meta.url === `file://${process.argv[1]}`) {
  await onboardMain(process.argv[2]);
}
