// Streaming runner: emits NDJSON events on stdout; ALL human logs go to stderr so
// stdout stays a clean event stream for the cockpit's SSE route.
// Usage: node --env-file=.env.local qa-agent/run-stream.mjs <onboard|review|merge> [prId]
for (const k of ["log", "info", "warn", "debug"]) {
  console[k] = (...a) => process.stderr.write(a.map(String).join(" ") + "\n");
}
const emit = (e) => process.stdout.write(JSON.stringify(e) + "\n");

const [cmd, prId, postArg] = process.argv.slice(2);

try {
  if (cmd === "onboard") {
    const { onboardMain } = await import("./onboard.mjs");
    await onboardMain({ onEvent: emit });
  } else if (cmd === "merge") {
    const { mergePR } = await import("./merge.mjs");
    await mergePR(prId || "pr-1", { onEvent: emit });
  } else {
    // Manual cockpit Re-run does NOT post to GitHub (avoid comment spam on every click);
    // the PR watcher passes post=1 so an auto-triggered review comments like the CLI does.
    const { reviewPR } = await import("./review.mjs");
    await reviewPR(prId || "1", { onEvent: emit, post: postArg === "1" });
  }
  emit({ type: "done" });
} catch (err) {
  emit({ type: "error", message: String(err?.message || err) });
  process.exitCode = 1;
}
// A managed-agent SDK call may still be in flight after a timeout; flush stdout + force exit
// so the SSE stream closes instead of hanging the run.
process.stdout.write("", () => process.exit(process.exitCode || 0));
