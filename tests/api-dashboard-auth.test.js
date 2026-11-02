import { test } from "node:test";
import assert from "node:assert/strict";
import { createLoginHandler } from "../api/dashboard/login.js";
import { createDashboardPageHandler } from "../api/dashboard-page.js";
import { signSession } from "../lib/session.js";

const env = { DASHBOARD_PASSWORD: "pw", SESSION_SECRET: "sec" };
const NOW = 1_700_000_000_000;
const login = (e, body, sleep = async () => {}) =>
  createLoginHandler({ env: e, now: () => NOW, sleep })(
    new Request("https://x.test/api/dashboard/login", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }),
  );

test("right password sets cookie", async () => {
  const res = await login(env, { password: "pw" });
  assert.equal(res.status, 204);
  const c = res.headers.get("set-cookie");
  assert.ok(c.startsWith(`ace_dash=${signSession("sec", NOW)};`));
  for (const f of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=604800"]) assert.ok(c.includes(f), f);
});
test("wrong or missing password gives 401, delayed, no cookie", async () => {
  for (const body of [{ password: "no" }, {}, "not json"]) {
    let slept = 0;
    const res = await login(env, body, async (ms) => { slept = ms; });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("set-cookie"), null);
    assert.equal(slept, 500);
  }
});
test("missing env gives 503", async () => {
  assert.equal((await login({ SESSION_SECRET: "sec" }, { password: "pw" })).status, 503);
  assert.equal((await login({ DASHBOARD_PASSWORD: "pw" }, { password: "pw" })).status, 503);
});

const page = (cookie) =>
  createDashboardPageHandler({
    env,
    now: () => NOW,
    readFile: async (n) => (n === "app.html" ? '<div id="dashboard-root"></div>' : '<form id="login-form"></form>'),
  })(new Request("https://x.test/dashboard", { headers: cookie ? { cookie } : {} }));

test("page: no cookie shows login", async () => {
  const res = await page();
  assert.match(await res.text(), /id="login-form"/);
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  assert.equal(res.headers.get("cache-control"), "no-store");
});
test("page: valid cookie shows app", async () => {
  const res = await page(`ace_dash=${signSession("sec", NOW)}`);
  assert.match(await res.text(), /id="dashboard-root"/);
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
});
test("page: tampered cookie shows login", async () => {
  const t = signSession("sec", NOW).replace(/.$/, (c) => (c === "0" ? "1" : "0"));
  assert.match(await (await page(`ace_dash=${t}`)).text(), /id="login-form"/);
});
