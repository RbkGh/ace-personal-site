import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./helpers/pg.js";
import { getStats } from "../lib/stats.js";

const NOW = new Date("2026-11-02T12:00:00Z");
const V1 = "00000000-0000-4000-8000-000000000001";
let n = 0;
async function seed(db, iso, o = {}) {
  n++;
  const pid = `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await db.query(
    `insert into pageviews (page_id, created_at, path, referrer_domain, country, city, visitor_id, ip, engaged_ms, max_scroll_pct)
     values ($1,$2,'/',$3,$4,$5,$6,$7,$8,$9)`,
    [pid, iso, o.ref ?? null, o.country ?? "GH", o.city ?? "Accra", o.visitor ?? null, o.ip ?? null, o.ms ?? 0, o.scroll ?? 0],
  );
}
async function fixture() {
  const db = await freshDb();
  await seed(db, "2026-11-02T01:00:00Z", { visitor: V1, ref: "news.ycombinator.com", ms: 4000, scroll: 50, ip: "1.2.3.4" });
  await seed(db, "2026-11-02T02:00:00Z", { visitor: V1, ref: "news.ycombinator.com", ms: 2000, scroll: 100 });
  await seed(db, "2026-11-02T03:00:00Z", {});
  await seed(db, "2026-10-28T10:00:00Z", { ref: "x.com" });
  await seed(db, "2026-10-28T11:00:00Z", {});
  await seed(db, "2026-09-23T10:00:00Z", {});
  await db.query(`insert into events (name, label) values ('footer_click','github'),('footer_click','github'),('modal_open',null)`);
  return db;
}

test("range totals", async () => {
  const db = await fixture();
  const views = async (r) => (await getStats(db.query, r, NOW)).totals;
  assert.deepEqual(await views("today"), { views: 3, visitors: 1, sessions: 0 });
  assert.equal((await views("7d")).views, 5);
  assert.equal((await views("30d")).views, 5);
  assert.equal((await views("all")).views, 6);
  await db.close();
});

test("series is zero-filled per calendar day", async () => {
  const db = await fixture();
  const s7 = (await getStats(db.query, "7d", NOW)).series;
  assert.equal(s7.length, 7);
  assert.equal(s7[0].day, "2026-10-27");
  assert.equal(s7[6].day, "2026-11-02");
  assert.deepEqual(s7.map((d) => d.views), [0, 2, 0, 0, 0, 0, 3]);
  assert.equal((await getStats(db.query, "today", NOW)).series.length, 1);
  assert.equal((await getStats(db.query, "30d", NOW)).series.length, 30);
  const all = (await getStats(db.query, "all", NOW)).series;
  assert.equal(all[0].day, "2026-09-23");
  assert.equal(all.length, 41);
  assert.equal(all.reduce((a, d) => a + d.views, 0), 6);
  await db.close();
});

test("breakdowns, events and engagement", async () => {
  const db = await fixture();
  const s = await getStats(db.query, "7d", NOW);
  assert.deepEqual(s.referrers, [{ domain: "news.ycombinator.com", views: 2 }, { domain: "x.com", views: 1 }]);
  assert.deepEqual(s.countries, [{ country: "GH", views: 5 }]);
  assert.equal(s.cities[0].city, "Accra");
  assert.deepEqual(s.events, [{ name: "footer_click", label: "github", count: 2 }, { name: "modal_open", label: null, count: 1 }]);
  assert.deepEqual(s.engagement, { avgEngagedMs: 3000, avgScrollPct: 75 });
  assert.equal(typeof s.totals.views, "number");
  await db.close();
});

test("recent: latest 50 regardless of range, newest first, includes ip", async () => {
  const db = await fixture();
  for (let i = 0; i < 60; i++) await seed(db, "2026-10-01T00:00:00Z");
  const s = await getStats(db.query, "today", NOW);
  assert.equal(s.recent.length, 50);
  assert.equal(s.recent[0].created_at, "2026-11-02T03:00:00.000Z");
  assert.equal(s.recent[2].ip, "1.2.3.4");
  await db.close();
});

test("rejects unknown range", async () => {
  const db = await freshDb();
  await assert.rejects(getStats(db.query, "year", NOW));
  await db.close();
});
