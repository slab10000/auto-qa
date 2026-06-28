// Code-side review via a remote Gemini managed agent (Antigravity).
// Reads the PR diff in an ephemeral sandbox and reasons about scope/risk —
// the second Gemini product, complementing the local Computer Use behavioral pass.
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

const stepsText = (res) =>
  (res.steps || [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => (s.content || []).map((c) => c.text || ""))
    .join("\n")
    .trim();

function parseJSON(text, fallback) {
  if (!text) return fallback;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try { return JSON.parse(raw.slice(s, e + 1)); } catch {}
    }
    return fallback;
  }
}

export async function codeReview(pr, diff, changedFiles, { onEvent } = {}) {
  const emit = onEvent || (() => {});
  emit({ type: "phase", phase: "code-review", message: "Managed agent reviewing the diff in a remote sandbox" });

  const res = await ai.interactions.create({
    agent: "antigravity-preview-05-2026",
    environment: "remote",
    input:
      `You are a senior code reviewer. Review this pull request's diff against its STATED scope and ` +
      `flag any changes that are risky or were not declared in the scope.\n\n` +
      `PR title: ${pr.title}\nPR description: ${pr.description}\n\n` +
      `Changed files: ${changedFiles.join(", ")}\n\nDiff:\n${diff}\n\n` +
      `Reply with ONLY a JSON object and nothing else: ` +
      `{"scope_match":"aligned|scope_creep|unclear","risk":"low|medium|high","summary":string,"concerns":[string]}.`,
  });

  const text = res.output_text || stepsText(res);
  const parsed = parseJSON(text, { scope_match: "unclear", risk: "unknown", summary: text, concerns: [] });
  const result = {
    ...parsed,
    environment_id: res.environment_id || null,
    ran_in: "remote managed agent · antigravity",
  };
  emit({ type: "code_review", ...result });
  return result;
}
