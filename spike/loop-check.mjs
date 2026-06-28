// Nail two things: (1) are coords pixels or normalized 0-1000? (2) does loop continuation work?
// Run: node --env-file=.env.local spike/loop-check.mjs
import { GoogleGenAI } from "@google/genai";
import { chromium } from "playwright";

const trunc = (_k, v) =>
  typeof v === "string" && v.length > 100 ? `${v.slice(0, 100)}…[${v.length}]` : v;

const ai = new GoogleGenAI({});
const W = 1280, H = 800;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: W, height: H });
await page.goto("https://example.com", { waitUntil: "load" });

const tools = [{ type: "computer_use", environment: "browser" }];
const ask = (input, prev) =>
  ai.interactions.create({ model: "gemini-3.5-flash", input, tools, ...(prev ? { previous_interaction_id: prev } : {}) });

// What DOM element sits under a given viewport point?
const atPoint = (px, py) =>
  page.evaluate(({ px, py }) => {
    const el = document.elementFromPoint(px, py);
    if (!el) return null;
    const a = el.closest("a");
    return { tag: el.tagName, text: (el.textContent || "").trim().slice(0, 40), aHref: a?.href || null };
  }, { px, py });

let shot = (await page.screenshot()).toString("base64");
let res = await ask([
  { type: "text", text: "Click the 'More information' link." },
  { type: "image", data: shot, mime_type: "image/png" },
]);
const step = res.steps.find((s) => s.type === "function_call");
console.log("action:", step.name, JSON.stringify(step.arguments));
const { x, y } = step.arguments;

const pixel = { x, y };
const norm = { x: Math.round((x / 1000) * W), y: Math.round((y / 1000) * H) };
const pixHit = await atPoint(pixel.x, pixel.y);
const normHit = await atPoint(norm.x, norm.y);
console.log("interpret as PIXELS    ", pixel, "→", JSON.stringify(pixHit));
console.log("interpret as NORMALIZED", norm, "→", JSON.stringify(normHit));

// Pick whichever interpretation lands on the <a>; default normalized per docs.
const useNorm = normHit?.aHref && !pixHit?.aHref ? true : pixHit?.aHref && !normHit?.aHref ? false : true;
const target = useNorm ? norm : pixel;
console.log(`\n>>> VERDICT: coords are ${useNorm ? "NORMALIZED (0-1000)" : "PIXELS"} — clicking`, target);
await page.mouse.click(target.x, target.y);
await page.waitForTimeout(1500);
console.log("URL after click:", page.url(), page.url().includes("iana.org") ? "✅ click landed" : "⚠️ no navigation");

// Validate loop continuation.
shot = (await page.screenshot()).toString("base64");
try {
  res = await ask(
    [{ type: "function_result", name: step.name, call_id: step.id,
       result: [
         { type: "text", text: JSON.stringify({ url: page.url() }) },
         { type: "image", data: shot, mime_type: "image/png" },
       ] }],
    res.id
  );
  console.log("\ncontinuation status:", res.status);
  console.log("next steps:", JSON.stringify(res.steps, trunc, 2));
  console.log("✅ loop continuation works");
} catch (e) {
  console.error("\n❌ continuation failed:", e?.message || e);
  console.error("→ likely needs step.signature echoed back; will handle in the real loop.");
}
await browser.close();
