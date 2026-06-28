// Spawns the qa-agent streaming runner and forwards its NDJSON events to the
// browser as Server-Sent Events. GET so the cockpit can use EventSource.
import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("cmd") || "review";
  const cmd = ["onboard", "merge", "review"].includes(raw) ? raw : "review";
  const pr = (url.searchParams.get("pr") || "pr-1").replace(/[^a-z0-9-]/gi, "");
  // Auto-triggered reviews (the PR watcher) post the comment to GitHub; manual Re-run stays
  // silent (post=0) so clicking it repeatedly doesn't spam the PR.
  const post = url.searchParams.get("post") === "1" ? "1" : "0";

  const child = spawn(
    "node",
    ["--env-file=.env.local", "qa-agent/run-stream.mjs", cmd, pr, post],
    { cwd: process.cwd() }
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const enqueue = (s: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(s)); } catch { closed = true; }
      };
      const sse = (line: string) => enqueue(`data: ${line}\n\n`);

      // Heartbeat. The managed-agent code review can sit SILENTLY for a minute+ at the end of a
      // review (the Antigravity sandbox is slow/degraded). With no bytes on the wire the SSE
      // connection gets dropped by the browser/OS/dev server, and the trailing done/exit event
      // is delivered into a dead socket — so the cockpit stalls forever even though the run
      // finished. A comment ping every 12s keeps the stream warm so the terminal event lands.
      const unref = (t: unknown) => { (t as { unref?: () => void })?.unref?.(); };
      const hb = setInterval(() => enqueue(`: hb\n\n`), 12000);
      unref(hb);
      // Backstop: never let a wedged child hold the connection open indefinitely.
      const cap = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 6 * 60_000);
      unref(cap);

      const finish = (code: number | null) => {
        clearInterval(hb);
        clearTimeout(cap);
        sse(JSON.stringify({ type: "exit", code }));
        closed = true;
        try { controller.close(); } catch {}
      };

      let buf = "";
      child.stdout.on("data", (d: Buffer) => {
        buf += d.toString();
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line.startsWith("{")) sse(line); // forward only JSON events
        }
      });
      child.stderr.on("data", (d: Buffer) => {
        // surface agent logs to the browser console without polluting the event stream
        sse(JSON.stringify({ type: "log", message: d.toString().trim() }));
      });
      child.on("error", (err: Error) => {
        sse(JSON.stringify({ type: "error", message: String(err?.message || err) }));
        finish(1);
      });
      child.on("close", (code) => finish(code));
    },
    cancel() {
      child.kill();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
    },
  });
}
