// De-risk the managed-agent (Antigravity) path before building the code-side reviewer on it.
// Run: node --env-file=.env.local spike/agent-check.mjs
import { GoogleGenAI } from "@google/genai";

const trunc = (_k, v) => (typeof v === "string" && v.length > 240 ? `${v.slice(0, 240)}…[${v.length}]` : v);
const ai = new GoogleGenAI({});

try {
  console.log("creating managed-agent interaction (spins up a remote sandbox)…");
  const res = await ai.interactions.create({
    agent: "antigravity-preview-05-2026",
    input: "Run `echo hello-from-sandbox` in the shell and report exactly what it printed.",
    environment: "remote",
  });
  console.log("status:", res.status);
  console.log("top-level keys:", Object.keys(res));
  console.log("environment id:", res.environment?.id || res.environment_id || res.environment || "(none)");
  console.log(JSON.stringify(res, trunc, 2).slice(0, 2500));
  console.log("\n✅ managed-agent endpoint reachable");
} catch (e) {
  console.error("\n❌ managed-agent call failed:", e?.message || e);
  console.error("→ If unavailable for this key, the code-side reviewer falls back to a plain Gemini diff-reasoning call.");
  process.exitCode = 1;
}
