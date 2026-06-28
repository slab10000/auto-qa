// Validate the agent can drive OUR sample app (not just example.com).
// Run: npm run drive-test
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serveStatic } from "./serve.mjs";
import { runGoal } from "./gemini.mjs";
import { VIEWPORT } from "./config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = await serveStatic(path.join(here, "..", "sample-app"));
console.log("serving sample-app (main) at", site.url);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize(VIEWPORT);
await page.goto(site.url, { waitUntil: "load" });

const { trace, finalText, status } = await runGoal(
  page,
  "You are a QA tester exploring this web app. Open the Settings screen, then stop.",
  { onStep: (s) => console.log(`  step ${s.i}: ${s.action} ${JSON.stringify(s.args)} → ${s.url}`) }
);

console.log("\nstatus:", status);
console.log("final:", finalText);
console.log("steps taken:", trace.length);
console.log("ended at:", page.url(), page.url().includes("settings") ? "✅ reached Settings" : "⚠️ did not reach Settings");

await browser.close();
await site.close();
