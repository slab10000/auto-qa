// Minimal static file server for running a target app locally during a QA run.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export function serveStatic(dir) {
  const root = path.resolve(dir);
  const server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      let file = path.join(root, pathname);
      if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (pathname === "/" ) file = path.join(root, "index.html");
      if (!file.startsWith(root) || !existsSync(file)) {
        res.statusCode = 404;
        return res.end("not found");
      }
      res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
      res.end(await readFile(file));
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err));
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        port,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
