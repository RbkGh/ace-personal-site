// Static server for e2e tests: serves the repo root, and answers every /api/*
// with 500 after a 3 s delay to simulate a broken backend.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".png": "image/png",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".json": "application/json",
};

http
  .createServer(async (req, res) => {
    let pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/")) {
      setTimeout(() => {
        res.writeHead(500);
        res.end("simulated failure");
      }, 3000);
      return;
    }
    if (pathname === "/") pathname = "/index.html";
    if (pathname === "/privacy") pathname = "/privacy.html";
    const file = path.join(root, path.normalize(pathname));
    if (!file.startsWith(root + path.sep) || /[\\/](\.git|node_modules)[\\/]/.test(file)) {
      res.writeHead(403);
      return res.end();
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  })
  .listen(PORT, () => console.log(`e2e server on http://localhost:${PORT}`));
