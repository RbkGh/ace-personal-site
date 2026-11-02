import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./helpers/pg.js";
import { anonymizeOldIps } from "../lib/retention.js";
import { createCronHandler } from "../api/cron/anonymize-ips.js";

const NOW = new Date("2026-11-02T03:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();

let seq = 0;
async function insertView(db, { ip, days }) {
  seq += 1;
  const pageId = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  await db.query(
    "insert into pageviews (page_id, created_at, ip) values ($1::uuid, $2::timestamptz, $3::inet)",
    [pageId, daysAgo(days), ip],
  );
  return pageId;
}
async function row(db, pageId) {
  const [r] = await db.query(
    "select host(ip) as ip, ip_anonymized from pageviews where page_id = $1::uuid",
    [pageId],
  );
  return r;
}

test("anonymises IPv4 older than 90 days to /24", async () => {
  const db = await freshDb();
  const id = await insertView(db, { ip: "203.0.113.77", days: 91 });
  assert.equal(await anonymizeOldIps(db.query, NOW), 1);
  assert.deepEqual(await row(db, id), { ip: "203.0.113.0", ip_anonymized: true });
  await db.close();
});

test("leaves IPv4 younger than 90 days untouched", async () => {
  const db = await freshDb();
  const id = await insertView(db, { ip: "203.0.113.77", days: 89 });
  assert.equal(await anonymizeOldIps(db.query, NOW), 0);
  assert.deepEqual(await row(db, id), { ip: "203.0.113.77", ip_anonymized: false });
  await db.close();
});

test("anonymises IPv6 older than 90 days to /48", async () => {
  const db = await freshDb();
  const id = await insertView(db, { ip: "2001:db8:abcd:12:3456::1", days: 91 });
  assert.equal(await anonymizeOldIps(db.query, NOW), 1);
  assert.deepEqual(await row(db, id), { ip: "2001:db8:abcd::", ip_anonymized: true });
  await db.close();
});

test("already-anonymised rows are not counted on a second run", async () => {
  const db = await freshDb();
  await insertView(db, { ip: "203.0.113.77", days: 91 });
  assert.equal(await anonymizeOldIps(db.query, NOW), 1);
  assert.equal(await anonymizeOldIps(db.query, NOW), 0);
  await db.close();
});

test("rows without an IP are not counted", async () => {
  const db = await freshDb();
  await insertView(db, { ip: null, days: 120 });
  assert.equal(await anonymizeOldIps(db.query, NOW), 0);
  await db.close();
});

const cronRequest = (auth) =>
  new Request("https://x.test/api/cron/anonymize-ips", {
    headers: auth === undefined ? {} : { authorization: auth },
  });
const quietLog = () => {};

test("cron handler: 401 without or with an incorrect bearer token", async () => {
  const GET = createCronHandler({ getQuery: () => null, env: { CRON_SECRET: "s3cret" }, log: quietLog });
  assert.equal((await GET(cronRequest())).status, 401);
  assert.equal((await GET(cronRequest("Bearer wrong"))).status, 401);
  assert.equal((await GET(cronRequest("s3cret"))).status, 401);
});

test("cron handler: 401 when CRON_SECRET is not configured", async () => {
  const GET = createCronHandler({ getQuery: () => null, env: {}, log: quietLog });
  assert.equal((await GET(cronRequest("Bearer "))).status, 401);
});

test("cron handler: 200 with the anonymised count on a correct token", async () => {
  const db = await freshDb();
  await insertView(db, { ip: "203.0.113.77", days: 91 });
  await insertView(db, { ip: "198.51.100.9", days: 10 });
  const GET = createCronHandler({ getQuery: () => db.query, env: { CRON_SECRET: "s3cret" }, log: quietLog });
  const res = await GET(cronRequest("Bearer s3cret"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { anonymized: 1 });
  await db.close();
});

test("cron handler: 500 and logs when the DB is not configured", async () => {
  const logged = [];
  const GET = createCronHandler({
    getQuery: () => null,
    env: { CRON_SECRET: "s3cret" },
    log: (...args) => logged.push(args),
  });
  const res = await GET(cronRequest("Bearer s3cret"));
  assert.equal(res.status, 500);
  assert.equal(logged.length, 1);
});

test("cron handler: 500 and logs when the query fails", async () => {
  const logged = [];
  const GET = createCronHandler({
    getQuery: () => async () => { throw new Error("down"); },
    env: { CRON_SECRET: "s3cret" },
    log: (...args) => logged.push(args),
  });
  const res = await GET(cronRequest("Bearer s3cret"));
  assert.equal(res.status, 500);
  assert.equal(logged.length, 1);
});
