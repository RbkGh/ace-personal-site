import { makeQuery, withTimeout } from "../../lib/db.js";
import { requireSession } from "../../lib/session.js";
import { RANGES, getStats } from "../../lib/stats.js";

const DB_TIMEOUT_MS = 5000;
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export function createDataHandler({ getQuery, env, now = Date.now }) {
  return async function handler(request) {
    if (!requireSession(request, env, now())) return json(401, { error: "unauthorized" });
    const range = new URL(request.url).searchParams.get("range") ?? "7d";
    if (!Object.hasOwn(RANGES, range)) return json(400, { error: "bad_range" });
    try {
      const query = getQuery();
      if (!query) throw new Error("DATABASE_URL not set");
      return json(200, await withTimeout(getStats(query, range, new Date(now())), DB_TIMEOUT_MS));
    } catch (err) {
      console.error("dashboard data failed:", err);
      return json(503, { error: "database_unavailable" });
    }
  };
}

export const GET = createDataHandler({
  getQuery: () => (process.env.DATABASE_URL ? makeQuery(process.env.DATABASE_URL) : null),
  env: process.env,
});
