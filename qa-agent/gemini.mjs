// Gemini client + the Computer Use agentic loop.
import { GoogleGenAI } from "@google/genai";
import { MODEL, CU_TOOL, VIEWPORT, MAX_STEPS } from "./config.mjs";
import { executeAction } from "./executor.mjs";

export const ai = new GoogleGenAI({});

const imagePart = (buf) => ({ type: "image", data: buf.toString("base64"), mime_type: "image/png" });

function functionCallOf(res) {
  return (res.steps || []).find((s) => s.type === "function_call");
}
function modelTextOf(res) {
  return (res.steps || [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => (s.content || []).map((c) => c.text || ""))
    .join("\n")
    .trim();
}

/**
 * Drive a Playwright page toward a natural-language goal using Computer Use.
 * Returns { trace, finalText, status } where each trace entry carries the
 * action, the model's stated intent, the resulting URL, and a screenshot Buffer.
 *
 * onStep(entry) is called after each executed action (entry has no screenshot
 * buffer to keep it light — use onShot for the image if needed).
 */
export async function runGoal(page, goal, { maxSteps = MAX_STEPS, onStep, onShot } = {}) {
  const trace = [];

  let res = await ai.interactions.create({
    model: MODEL,
    input: [{ type: "text", text: goal }, imagePart(await page.screenshot())],
    tools: [CU_TOOL],
  });

  for (let i = 0; i < maxSteps; i++) {
    const fc = functionCallOf(res);
    if (!fc) {
      return { trace, finalText: modelTextOf(res) || "(done)", status: res.status || "completed" };
    }

    const exec = await executeAction(page, fc, VIEWPORT);
    const shot = await page.screenshot();
    const entry = {
      i,
      action: fc.name,
      args: fc.arguments || {},
      intent: fc.arguments?.intent || "",
      url: page.url(),
      ok: exec.ok,
      signature: exec.signature || null,
    };
    trace.push({ ...entry, screenshot: shot });
    onStep?.(entry);
    onShot?.(i, shot, entry);

    res = await ai.interactions.create({
      model: MODEL,
      previous_interaction_id: res.id,
      input: [
        {
          type: "function_result",
          name: fc.name,
          call_id: fc.id,
          result: [
            { type: "text", text: JSON.stringify({ url: page.url(), ...exec }) },
            imagePart(shot),
          ],
        },
      ],
      tools: [CU_TOOL],
    });
  }

  return { trace, finalText: "(reached max steps)", status: "max_steps" };
}

/**
 * One-shot multimodal reasoning call (no Computer Use) — used by Pass 2 to
 * compare two screenshots and reason about whether changes are intended.
 * Returns the model's text.
 */
export async function reason(promptText, images = []) {
  const res = await ai.interactions.create({
    model: MODEL,
    input: [{ type: "text", text: promptText }, ...images.map(imagePart)],
  });
  return modelTextOf(res) || (res.steps || []).map((s) => s.content?.map?.((c) => c.text).join("")).join("\n").trim();
}
