import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_KEY, OPTOUT_KEY, VID_KEY, SID_KEY,
  getConsent, setConsent, isOptedOut, getIds, parseUtm, scrollPercent,
} from "../analytics/lib.js";

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const seq = () => { let n = 0; return () => `id-${++n}`; };

test("getConsent is null on empty storage", () => {
  assert.equal(getConsent(fakeStorage()), null);
});

test("getConsent round-trips accepted and declined", () => {
  const s = fakeStorage();
  setConsent(s, "accepted");
  assert.equal(getConsent(s), "accepted");
  setConsent(s, "declined");
  assert.equal(getConsent(s), "declined");
});

test("getConsent returns null for garbage", () => {
  const s = fakeStorage();
  s.setItem(CONSENT_KEY, "maybe");
  assert.equal(getConsent(s), null);
});

test("setConsent declined removes visitor and session ids", () => {
  const s = fakeStorage();
  getIds(s, 1000, seq());
  assert.ok(s.getItem(VID_KEY) && s.getItem(SID_KEY));
  setConsent(s, "declined");
  assert.equal(s.getItem(VID_KEY), null);
  assert.equal(s.getItem(SID_KEY), null);
});

test("getIds keeps visitor and session within 29 minutes", () => {
  const s = fakeStorage(), u = seq();
  const a = getIds(s, 0, u);
  const b = getIds(s, 29 * MIN, u);
  assert.deepEqual(b, a);
});

test("getIds starts a new session after 31 minutes, same visitor", () => {
  const s = fakeStorage(), u = seq();
  const a = getIds(s, 0, u);
  const b = getIds(s, 31 * MIN, u);
  assert.equal(b.visitorId, a.visitorId);
  assert.notEqual(b.sessionId, a.sessionId);
});

test("getIds session activity slides forward", () => {
  const s = fakeStorage(), u = seq();
  const a = getIds(s, 0, u);
  getIds(s, 20 * MIN, u);
  const c = getIds(s, 45 * MIN, u);
  assert.equal(c.sessionId, a.sessionId);
});

test("getIds issues a new visitor after 366 days", () => {
  const s = fakeStorage(), u = seq();
  const a = getIds(s, 0, u);
  const b = getIds(s, 366 * DAY, u);
  assert.notEqual(b.visitorId, a.visitorId);
});

test("getIds tolerates corrupt stored values", () => {
  const s = fakeStorage();
  s.setItem(VID_KEY, "{not json");
  s.setItem(SID_KEY, "null");
  const r = getIds(s, 0, seq());
  assert.ok(r.visitorId && r.sessionId);
});

test("parseUtm maps present params and nulls the rest", () => {
  assert.deepEqual(parseUtm("?utm_source=linkedin&utm_campaign=launch"), {
    source: "linkedin", medium: null, campaign: "launch", term: null, content: null,
  });
  assert.deepEqual(parseUtm(""), { source: null, medium: null, campaign: null, term: null, content: null });
});

test("scrollPercent", () => {
  assert.equal(scrollPercent(0, 800, 800), 100);
  assert.equal(scrollPercent(0, 800, 1600), 50);
  assert.equal(scrollPercent(800, 800, 1600), 100);
  assert.equal(scrollPercent(5000, 800, 1600), 100);
});

test("isOptedOut only for '1'", () => {
  const s = fakeStorage();
  assert.equal(isOptedOut(s), false);
  s.setItem(OPTOUT_KEY, "0");
  assert.equal(isOptedOut(s), false);
  s.setItem(OPTOUT_KEY, "1");
  assert.equal(isOptedOut(s), true);
});
