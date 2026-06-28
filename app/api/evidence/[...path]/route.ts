// Streams files (screenshots, json) out of .autoqa for the cockpit.
import fs from "node:fs";
import path from "node:path";

const AUTOQA = path.join(process.cwd(), ".autoqa");
const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const file = path.join(AUTOQA, ...parts);
  if (!file.startsWith(AUTOQA) || !fs.existsSync(file)) {
    return new Response("not found", { status: 404 });
  }
  const buf = fs.readFileSync(file);
  return new Response(buf, {
    headers: { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" },
  });
}
