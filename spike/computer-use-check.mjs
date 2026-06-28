// Validate the full Computer Use path: Playwright screenshot -> computer_use -> function_call.
// Run: node --env-file=.env.local spike/computer-use-check.mjs
import { GoogleGenAI } from "@google/genai";
import { chromium } from "playwright";

// Truncate long strings (base64 blobs) so logs stay readable.
const trunc = (_k, v) =>
  typeof v === "string" && v.length > 120 ? `${v.slice(0, 120)}…[${v.length} chars]` : v;

const ai = new GoogleGenAI({});
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("https://example.com", { waitUntil: "load" });

const shot = await page.screenshot();
const b64 = shot.toString("base64");
console.log(`screenshot captured: ${shot.length} bytes`);

try {
  const interaction = await ai.interactions.create({
    model: "gemini-3.5-flash",
    input: [
      { type: "text", text: "Click the 'More information' link on this page." },
      { type: "image", data: b64, mime_type: "image/png" },
    ],
    tools: [{ type: "computer_use", environment: "browser", enable_prompt_injection_detection: true }],
  });

  console.log("\n=== TOP-LEVEL KEYS ===", Object.keys(interaction));
  console.log("\n=== FULL RESPONSE (truncated) ===");
  console.log(JSON.stringify(interaction, trunc, 2));

  // Probe the documented shapes for the function call.
  const steps = interaction.steps || interaction.output || interaction.outputs || [];
  const fc = (Array.isArray(steps) ? steps : []).find(
    (s) => s?.type === "function_call" || s?.name
  );
  console.log("\n=== EXTRACTED FUNCTION CALL ===", JSON.stringify(fc ?? null, trunc, 2));
  console.log("\n✅ Computer Use call succeeded — inspect the shape above.");
} catch (err) {
  console.error("\n❌ Computer Use call FAILED:");
  console.error(err?.message || err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
