import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUserAgent, isBot } from "../lib/ua.js";

const UA = {
  chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  firefoxWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.56",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
};

test("Chrome on macOS", () => {
  const r = parseUserAgent(UA.chromeMac);
  assert.equal(r.device, "desktop");
  assert.equal(r.browser, "Chrome");
  assert.equal(r.os, "macOS");
  assert.ok(r.browserVersion);
  assert.ok(r.osVersion);
});

test("Safari on iPhone", () => {
  const r = parseUserAgent(UA.safariIphone);
  assert.equal(r.device, "mobile");
  assert.equal(r.browser, "Safari");
  assert.equal(r.os, "iOS");
  assert.equal(r.osVersion, "18.1");
});

test("iPad is tablet", () => {
  assert.equal(parseUserAgent(UA.ipad).device, "tablet");
});

test("Firefox on Windows", () => {
  const r = parseUserAgent(UA.firefoxWin);
  assert.equal(r.browser, "Firefox");
  assert.equal(r.os, "Windows");
  assert.equal(r.browserVersion, "132.0");
  assert.equal(r.device, "desktop");
});

test("Edge reports Edge, not Chrome", () => {
  const r = parseUserAgent(UA.edgeWin);
  assert.equal(r.browser, "Edge");
  assert.equal(r.os, "Windows");
});

test("Samsung Internet on Android", () => {
  const r = parseUserAgent(UA.samsung);
  assert.equal(r.browser, "Samsung Internet");
  assert.equal(r.os, "Android");
  assert.equal(r.osVersion, "14");
  assert.equal(r.device, "mobile");
});

test("unknown UA", () => {
  assert.equal(parseUserAgent("").device, "unknown");
});

test("isBot", () => {
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
    "curl/8.7.1",
    "",
  ]) assert.equal(isBot(ua), true, ua);
  for (const ua of Object.values(UA)) assert.equal(isBot(ua), false, ua);
});
