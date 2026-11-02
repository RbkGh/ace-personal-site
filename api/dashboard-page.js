import { readFile as fsReadFile } from "node:fs/promises";
import path from "node:path";
import { requireSession } from "../lib/session.js";

const realReadFile = (name) => fsReadFile(path.join(process.cwd(), "dashboard", name), "utf8");

export function createDashboardPageHandler({ env, readFile, now = Date.now }) {
  return async function handler(request) {
    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    };
    try {
      const authed = requireSession(request, env, now());
      const body = await readFile(authed ? "app.html" : "login.html");
      return new Response(body, { status: 200, headers });
    } catch (err) {
      console.error("dashboard page failed:", err);
      return new Response("Error", { status: 500, headers });
    }
  };
}

export const GET = createDashboardPageHandler({ env: process.env, readFile: realReadFile });
