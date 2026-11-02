import { makeQuery } from "../../lib/db.js";
import { safeEqual } from "../../lib/session.js";
import { anonymizeOldIps } from "../../lib/retention.js";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export function createCronHandler({ getQuery, env, log = console.error }) {
  return async function handler(request) {
    const secret = env.CRON_SECRET;
    if (!secret) return json(401, { error: "unauthorized" });
    const auth = request.headers.get("authorization") ?? "";
    if (!safeEqual(auth, `Bearer ${secret}`)) return json(401, { error: "unauthorized" });
    try {
      const query = getQuery();
      if (!query) throw new Error("DATABASE_URL not set");
      return json(200, { anonymized: await anonymizeOldIps(query) });
    } catch (err) {
      log("ip anonymisation cron failed:", err);
      return json(500, { error: "database_unavailable" });
    }
  };
}

export const GET = createCronHandler({
  getQuery: () => (process.env.DATABASE_URL ? makeQuery(process.env.DATABASE_URL) : null),
  env: process.env,
});
