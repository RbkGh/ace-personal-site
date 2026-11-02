import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession, safeEqual, readCookie, SESSION_TTL_MS } from "../lib/session.js";

const S = "secret";
const T = 1_700_000_000_000;

test("valid session verifies", () => {
  assert.equal(verifySession(signSession(S, T), S, T + 1000), true);
});
test("expired session fails", () => {
  assert.equal(verifySession(signSession(S, T), S, T + SESSION_TTL_MS + 1), false);
});
test("other secret fails", () => {
  assert.equal(verifySession(signSession(S, T), "other", T + 1000), false);
});
test("tampered expiry fails", () => {
  const [, sig] = signSession(S, T).split(".");
  assert.equal(verifySession(`${T + SESSION_TTL_MS * 2}.${sig}`, S, T + 1000), false);
});
test("garbage tokens fail", () => {
  for (const t of [undefined, "", "abc", ".", "1.", ".abc"]) assert.equal(verifySession(t, S, T), false);
});
test("safeEqual", () => {
  assert.equal(safeEqual("a", "a"), true);
  assert.equal(safeEqual("a", "b"), false);
  assert.equal(safeEqual("a", "ab"), false);
});
test("readCookie finds named cookie", () => {
  const h = new Headers({ cookie: "x=1; ace_dash=abc.def; y=2" });
  assert.equal(readCookie(h, "ace_dash"), "abc.def");
  assert.equal(readCookie(h, "nope"), undefined);
  assert.equal(readCookie(new Headers(), "x"), undefined);
});
