import { makeQuery, withTimeout } from "../lib/db.js";
import { normalizePayload, recordHit } from "../lib/collect.js";
import { isBot } from "../lib/ua.js";

const MAX_BODY_BYTES = 4096;
const DB_TIMEOUT_MS = 1500;
const WRITE_ENVS = new Set(["production", "development"]);
const HTTPS_HOSTS = new Set(["rodneyboachie.com", "www.rodneyboachie.com", "ace-personal-site.vercel.app"]);

// Accepts an Origin or Referer value; only its scheme + host are considered.
function isAllowedSource(value) {
  let u;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol === "https:") return HTTPS_HOSTS.has(u.hostname);
  return u.protocol === "http:" && u.hostname === "localhost";
}

function sourceAllowed(headers) {
  const origin = headers.get("origin");
  if (origin) return isAllowedSource(origin);
  const referer = headers.get("referer");
  return referer ? isAllowedSource(referer) : false;
}

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export function createCollectHandler({ getQuery, env, log = console.error }) {
  return async function handler(request) {
    try {
      if (!WRITE_ENVS.has(env.VERCEL_ENV)) return noContent();
      if (!sourceAllowed(request.headers)) return noContent();
      if (isBot(request.headers.get("user-agent") || "")) return noContent();

      const text = await request.text();
      if (Buffer.byteLength(text) > MAX_BODY_BYTES) return noContent();
      let body;
      try { body = JSON.parse(text); } catch { return noContent(); }
      const payload = normalizePayload(body);
      if (!payload) return noContent();

      const query = getQuery();
      if (!query) return noContent();
      await withTimeout(recordHit(query, payload, { headers: request.headers }), DB_TIMEOUT_MS);
    } catch (err) {
      try { log("collect failed:", err); } catch { /* logging must never throw */ }
    }
    return noContent();
  };
}

export const POST = createCollectHandler({
  getQuery: () => (process.env.DATABASE_URL ? makeQuery(process.env.DATABASE_URL) : null),
  env: process.env,
});
