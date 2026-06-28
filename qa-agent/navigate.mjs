// reachGoal: accomplish a goal with Computer Use, but reuse a cached action route when one exists
// and still targets the same elements — so repeat passes skip the expensive exploration round-trips.
// Cold pass: explore + record the route. Warm pass: verify signatures + replay (0 model calls).
// If the UI changed (signature mismatch), it falls back to a fresh exploration and re-records.
import { runGoal } from "./gemini.mjs";
import { executeAction, sigAt } from "./executor.mjs";
import { loadRoute, saveRoute, routeKey } from "./routes.mjs";
import { VIEWPORT } from "./config.mjs";

const pathOf = (u) => {
  try { return new URL(u).pathname; } catch { return u; }
};
const toPx = (x, y) => ({ x: Math.round((x / 1000) * VIEWPORT.width), y: Math.round((y / 1000) * VIEWPORT.height) });

export async function reachGoal(page, goal, { cacheKey, onStep, onShot } = {}) {
  const key = cacheKey || routeKey(goal);
  const route = await loadRoute(key);
  const t0 = Date.now();

  if (route?.actions?.length) {
    // Verify every cached action still targets the same element (cheap, no model call).
    let valid = true;
    for (const act of route.actions) {
      if (act.x == null) continue;
      const px = toPx(act.x, act.y);
      const sig = await sigAt(page, px.x, px.y);
      if (!sig || (act.signature?.text && sig.text !== act.signature.text)) { valid = false; break; }
    }
    if (valid) {
      for (const act of route.actions) {
        await executeAction(page, { name: act.name, arguments: act }, VIEWPORT);
        const entry = { action: act.name, intent: act.intent, url: page.url(), cached: true };
        onStep?.(entry);
        if (onShot) onShot(0, await page.screenshot(), entry);
      }
      return { cached: true, llmCalls: 0, ms: Date.now() - t0, actions: route.actions };
    }
  }

  // Cold: explore with Computer Use, then record the route for next time.
  const res = await runGoal(page, goal, { onStep, onShot });
  const actions = res.trace
    .filter((t) => t.args && t.args.x != null)
    .map((t) => ({ name: t.action, x: t.args.x, y: t.args.y, intent: t.intent, signature: t.signature || null }));
  await saveRoute(key, { goal, actions, expected_url: pathOf(page.url()), learned_at: new Date().toISOString() });
  return { cached: false, llmCalls: res.trace.length + 1, ms: Date.now() - t0, actions };
}
