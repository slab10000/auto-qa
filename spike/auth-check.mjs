// Fail-fast: does the API key authenticate at all?
// Run: node --env-file=.env.local spike/auth-check.mjs
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
console.log("key present:", Boolean(key), key ? `(${key.slice(0, 6)}…, len ${key.length})` : "");

const ai = new GoogleGenAI({});

const MODELS = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];

for (const model of MODELS) {
  try {
    const res = await ai.models.generateContent({
      model,
      contents: "Reply with exactly: OK",
    });
    console.log(`✅ AUTH OK via ${model} →`, JSON.stringify(res.text));
    process.exit(0);
  } catch (err) {
    const msg = (err && (err.message || String(err))).split("\n")[0];
    console.log(`❌ ${model}: ${msg}`);
  }
}

console.error("\nAll model calls failed — key likely invalid or wrong format. Regenerate at https://aistudio.google.com/api-keys");
process.exit(1);
