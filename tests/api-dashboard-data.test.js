import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./helpers/pg.js";
import { createDataHandler } from "../api/dashboard/data.js";
import { COOKIE_NAME, signSession } from "../lib/session.js";

const env = { SESSION_SECRET: "sec" };
const NOW = Date.parse("2026-11-02T12:00:00Z");
const cookie = `${COOKIE_NAME}=${signSession("sec", NOW)}`;
const call = (getQuery, url = "https://x.test/api/dashboard/data?range=7d", c = cookie) =>
  createDataHandler({ getQuery, env, now: () => NOW })(new Request(url, { headers: c ? { cookie: c } : {} }));

test("401 without a valid cookie", async () => {
  assert.equal((await call(() => null, undefined, null)).status, 401);
  assert.equal((await call(() => null, undefined, `${COOKIE_NAME}=bad`)).status, 401);
});
test("400 for a bad range", async () => {
  assert.equal((await call(() => null, "https://x.test/api/dashboard/data?range=year")).status, 400);
});
test("503 when the query rejects or DB is not configured", async () => {
  const origErr = console.error; console.error = () => {};
  try {
    for (const getQuery of [() => async () => { throw new Error("down"); }, () => null]) {
      const res = await call(getQuery);
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: "database_unavailable" });
    }
  } finally { console.error = origErr; }
});
test("200 with totals, no-store", async () => {
  const db = await freshDb();
  const res = await call(() => db.query);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual((await res.json()).totals, { views: 0, visitors: 0, sessions: 0 });
  await db.close();
});
