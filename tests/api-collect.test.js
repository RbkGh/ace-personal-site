import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./helpers/pg.js";
import { createCollectHandler } from "../api/collect.js";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const PV = { type: "pageview", pageId: "00000000-0000-4000-8000-000000000001", path: "/", referrer: "", consent: false };

function req(body, headers = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("https://rodneyboachie.com/api/collect", {
    method: "POST",
    headers: { "content-type": "text/plain", "user-agent": CHROME, origin: "https://rodneyboachie.com", ...headers },
    body: raw,
  });
}

async function setup({ env = { VERCEL_ENV: "production" }, wrap } = {}) {
  const db = await freshDb();
  const logs = [];
  const query = wrap ? wrap(db.query) : db.query;
  const handler = createCollectHandler({ getQuery: () => query, env, log: (...a) => logs.push(a) });
  const count = async () => (await db.query("select count(*)::int as n from pageviews"))[0].n;
  return { db, handler, logs, count };
}

async function expectNoWrite(request, opts) {
  const { db, handler, count } = await setup(opts);
  const res = await handler(request);
  assert.equal(res.status, 204);
  assert.equal(await count(), 0);
  await db.close();
}

test("valid pageview is stored, 204, no-store", async () => {
  const { db, handler, count } = await setup();
  const res = await handler(req(PV));
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(await count(), 1);
  await db.close();
});

test("rejected inputs answer 204 and write nothing", async () => {
  await expectNoWrite(req(JSON.stringify({ ...PV, path: "/" + "a".repeat(5000) })));
  await expectNoWrite(req("{not json"));
  await expectNoWrite(req(PV, { origin: "https://evil.example" }));
  await expectNoWrite(req(PV, { "user-agent": "Googlebot/2.1" }));
  await expectNoWrite(req(PV), { env: { VERCEL_ENV: "preview" } });
  await expectNoWrite(req(PV), { env: {} });
});

test("null query is a no-op 204", async () => {
  const handler = createCollectHandler({ getQuery: () => null, env: { VERCEL_ENV: "production" }, log: () => {} });
  assert.equal((await handler(req(PV))).status, 204);
});

test("localhost origin accepted; development env allowed", async () => {
  const { db, handler, count } = await setup({ env: { VERCEL_ENV: "development" } });
  await handler(req(PV, { origin: "http://localhost:3000" }));
  assert.equal(await count(), 1);
  await db.close();
});

test("referer fallback when Origin absent; neither rejects", async () => {
  const { db, handler, count } = await setup();
  const noOrigin = (h) => {
    const r = req(PV, h);
    r.headers.delete("origin");
    return r;
  };
  await handler(noOrigin({ referer: "https://rodneyboachie.com/" }));
  assert.equal(await count(), 1);
  const res = await handler(noOrigin({}));
  assert.equal(res.status, 204);
  assert.equal(await count(), 1);
  await handler(noOrigin({ referer: "https://evil.example/" }));
  assert.equal(await count(), 1);
  await db.close();
});

test("lookalike hosts are rejected", async () => {
  await expectNoWrite(req(PV, { origin: "https://rodneyboachie.com.evil.example" }));
  await expectNoWrite(req(PV, { origin: "http://rodneyboachie.com" }));
});

test("query failure: 204 and logged once", async () => {
  const { db, handler, logs } = await setup({ wrap: () => async () => { throw new Error("db down"); } });
  const res = await handler(req(PV));
  assert.equal(res.status, 204);
  assert.equal(logs.length, 1);
  await db.close();
});

test("hanging query: 204 within 2000 ms", async () => {
  const { db, handler } = await setup({ wrap: () => () => new Promise(() => {}) });
  const t = Date.now();
  const res = await handler(req(PV));
  assert.equal(res.status, 204);
  assert.ok(Date.now() - t < 2000);
  await db.close();
});
