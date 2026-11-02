import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./helpers/pg.js";
import { normalizePayload, geoFromHeaders, clientIp, recordHit } from "../lib/collect.js";

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const pv = (o = {}) => ({
  type: "pageview", pageId: U(1), path: "/", referrer: "", language: "en-US", timezone: "UTC",
  screen: { w: 1920, h: 1080 }, viewport: { w: 1200, h: 800 }, consent: false, ...o,
});

test("normalizePayload rejects invalid input", () => {
  for (const b of [null, "x", 5, [], {}, { type: "nope", pageId: U(1) },
    pv({ pageId: undefined }), pv({ pageId: "not-a-uuid" }), pv({ path: "/" + "a".repeat(512) }),
    { type: "event", pageId: U(1), name: "evil" },
    { type: "event", pageId: U(1), name: "footer_click", label: "facebook" },
    { type: "event", pageId: U(1), name: "footer_click" },
  ]) assert.equal(normalizePayload(b), null, JSON.stringify(b));
});

test("normalizePayload accepts valid events", () => {
  assert.deepEqual(normalizePayload({ type: "event", pageId: U(1), name: "footer_click", label: "github" }),
    { type: "event", pageId: U(1), name: "footer_click", label: "github", consent: false });
  const m = normalizePayload({ type: "event", pageId: U(1), name: "modal_open", label: "ignored" });
  assert.equal(m.name, "modal_open");
  assert.equal(m.label, undefined);
});

test("strips IDs unless consent === true", () => {
  const ids = { visitorId: U(2), sessionId: U(3) };
  for (const consent of [false, undefined, "true", 1]) {
    const p = normalizePayload(pv({ consent, ...ids }));
    assert.equal(p.consent, false);
    assert.equal(p.visitorId, undefined);
    assert.equal(p.sessionId, undefined);
  }
  const p = normalizePayload(pv({ consent: true, ...ids }));
  assert.equal(p.visitorId, U(2));
  assert.equal(p.sessionId, U(3));
  const e = normalizePayload({ type: "event", pageId: U(1), name: "modal_open", consent: true, ...ids });
  assert.equal(e.visitorId, U(2));
});

test("truncates and clamps", () => {
  const p = normalizePayload(pv({
    referrer: "https://x.com/" + "a".repeat(2000),
    utm: { source: "s".repeat(500), medium: "m", campaign: "c", term: "t", content: "k".repeat(300) },
  }));
  assert.equal(p.referrer.length, 1024);
  assert.equal(p.utm.source.length, 256);
  assert.equal(p.utm.content.length, 256);
  assert.equal(p.utm.medium, "m");
  const hi = normalizePayload({ type: "engagement", pageId: U(1), engagedMs: 9e12, scrollPct: 250 });
  assert.deepEqual(hi, { type: "engagement", pageId: U(1), engagedMs: 86_400_000, scrollPct: 100 });
  const lo = normalizePayload({ type: "engagement", pageId: U(1), engagedMs: -5, scrollPct: -3 });
  assert.equal(lo.engagedMs, 0);
  assert.equal(lo.scrollPct, 0);
});

test("geoFromHeaders and clientIp", () => {
  const h = new Headers({ "x-vercel-ip-country": "BR", "x-vercel-ip-country-region": "SP", "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" });
  assert.deepEqual(geoFromHeaders(h), { country: "BR", region: "SP", city: "São Paulo" });
  assert.equal(clientIp(h), "203.0.113.7");
  assert.equal(clientIp(new Headers()), null);
  assert.deepEqual(geoFromHeaders(new Headers({ "x-vercel-ip-city": "%E0%A4%A" })).city, "%E0%A4%A");
});

test("recordHit pageview without consent", async () => {
  const db = await freshDb();
  const headers = new Headers({
    "user-agent": CHROME, "x-vercel-ip-country": "BR", "x-vercel-ip-country-region": "SP",
    "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-forwarded-for": "203.0.113.7",
  });
  const p = normalizePayload(pv({ referrer: "https://news.ycombinator.com/item?id=1", visitorId: U(2), sessionId: U(3), utm: { source: "hn" } }));
  await recordHit(db.query, p, { headers });
  const [r] = await db.query("select * from pageviews");
  assert.equal(r.visitor_id, null);
  assert.equal(r.session_id, null);
  assert.equal(r.ip, null);
  assert.equal(r.city, "São Paulo");
  assert.equal(r.country, "BR");
  assert.equal(r.region, "SP");
  assert.equal(r.referrer_domain, "news.ycombinator.com");
  assert.equal(r.utm_source, "hn");
  assert.equal(r.browser, "Chrome");
  assert.equal(r.os, "macOS");
  assert.equal(r.device, "desktop");
  assert.equal(r.screen_w, 1920);
  assert.equal(r.viewport_h, 800);
  await db.close();
});

test("recordHit same-site and empty referrers give null domain", async () => {
  const db = await freshDb();
  const refs = ["https://rodneyboachie.com/x", "https://www.rodneyboachie.com/", "https://ace-personal-site.vercel.app/", "http://localhost:3000/", "", "garbage"];
  for (let i = 0; i < refs.length; i++) {
    await recordHit(db.query, normalizePayload(pv({ pageId: U(10 + i), referrer: refs[i] })), { headers: new Headers() });
  }
  const rows = await db.query("select referrer_domain from pageviews");
  assert.equal(rows.length, refs.length);
  assert.ok(rows.every((r) => r.referrer_domain === null));
  await db.close();
});

test("recordHit pageview with consent stores ip and ids", async () => {
  const db = await freshDb();
  const headers = new Headers({ "user-agent": CHROME, "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
  await recordHit(db.query, normalizePayload(pv({ consent: true, visitorId: U(2), sessionId: U(3) })), { headers });
  const [r] = await db.query("select visitor_id, session_id, host(ip) as ip from pageviews");
  assert.equal(r.ip, "203.0.113.7");
  assert.equal(r.visitor_id, U(2));
  assert.equal(r.session_id, U(3));
  await db.close();
});

test("recordHit tolerates unparseable forwarded ip", async () => {
  const db = await freshDb();
  const headers = new Headers({ "x-forwarded-for": "not-an-ip" });
  await recordHit(db.query, normalizePayload(pv({ consent: true })), { headers });
  const [r] = await db.query("select ip from pageviews");
  assert.equal(r.ip, null);
  await db.close();
});

test("recordHit event", async () => {
  const db = await freshDb();
  const p = normalizePayload({ type: "event", pageId: U(1), name: "footer_click", label: "github", consent: true, visitorId: U(2), sessionId: U(3) });
  await recordHit(db.query, p, { headers: new Headers() });
  const [r] = await db.query("select * from events");
  assert.equal(r.name, "footer_click");
  assert.equal(r.label, "github");
  assert.equal(r.visitor_id, U(2));
  await db.close();
});

test("engagement uses GREATEST and ignores unknown page", async () => {
  const db = await freshDb();
  const ctx = { headers: new Headers() };
  await recordHit(db.query, normalizePayload(pv()), ctx);
  await recordHit(db.query, normalizePayload({ type: "engagement", pageId: U(1), engagedMs: 5000, scrollPct: 40 }), ctx);
  await recordHit(db.query, normalizePayload({ type: "engagement", pageId: U(1), engagedMs: 3000, scrollPct: 70 }), ctx);
  await recordHit(db.query, normalizePayload({ type: "engagement", pageId: U(99), engagedMs: 3000, scrollPct: 70 }), ctx);
  const rows = await db.query("select engaged_ms, max_scroll_pct from pageviews");
  assert.deepEqual(rows, [{ engaged_ms: 5000, max_scroll_pct: 70 }]);
  await db.close();
});

test("duplicate pageview is ignored", async () => {
  const db = await freshDb();
  const ctx = { headers: new Headers() };
  await recordHit(db.query, normalizePayload(pv()), ctx);
  await recordHit(db.query, normalizePayload(pv()), ctx);
  assert.equal((await db.query("select count(*)::int as n from pageviews"))[0].n, 1);
  await db.close();
});
