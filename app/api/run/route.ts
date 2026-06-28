// Spawns the qa-agent streaming runner and forwards its NDJSON events to the
// browser as Server-Sent Events. GET so the cockpit can use EventSource.
import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("cmd") || "review";
  const cmd = ["onboard", "merge", "review"].includes(raw) ? raw : "review";
  const pr = (url.searchParams.get("pr") || "pr-1").replace(/[^a-z0-9-]/gi, "");

  const child = spawn(
    "node",
    ["--env-file=.env.local", "qa-agent/run-stream.mjs", cmd, pr],
    { cwd: process.cwd() }
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sse = (line: string) => {
        try { controller.enqueue(encoder.encode(`data: ${line}\n\n`)); } catch {}
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
      child.on("close", (code) => {
        sse(JSON.stringify({ type: "exit", code }));
        try { controller.close(); } catch {}
      });
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
