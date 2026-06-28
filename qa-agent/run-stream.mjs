// Streaming runner: emits NDJSON events on stdout; ALL human logs go to stderr so
// stdout stays a clean event stream for the cockpit's SSE route.
// Usage: node --env-file=.env.local qa-agent/run-stream.mjs <onboard|review|merge> [prId]
for (const k of ["log", "info", "warn", "debug"]) {
  console[k] = (...a) => process.stderr.write(a.map(String).join(" ") + "\n");
}
const emit = (e) => process.stdout.write(JSON.stringify(e) + "\n");

const [cmd, prId] = process.argv.slice(2);

try {
  if (cmd === "onboard") {
    const { onboardMain } = await import("./onboard.mjs");
    await onboardMain(undefined, { onEvent: emit });
  } else if (cmd === "merge") {
    const { mergePR } = await import("./merge.mjs");
    await mergePR(prId || "pr-1", { onEvent: emit });
  } else {
    const { reviewPR } = await import("./review.mjs");
    await reviewPR(prId || "pr-1", { onEvent: emit });
  }
  emit({ type: "done" });
} catch (err) {
  emit({ type: "error", message: String(err?.message || err) });
  process.exitCode = 1;
}
