// Pure helpers: no DOM access at import time.
export const CONSENT_KEY = "ace_consent";
export const OPTOUT_KEY = "ace_analytics_optout";
export const VID_KEY = "ace_vid";
export const SID_KEY = "ace_sid";

const DAY = 24 * 60 * 60 * 1000;
const VISITOR_TTL = 365 * DAY;
const SESSION_TTL = 30 * 60 * 1000;

export function getConsent(storage) {
  const v = storage.getItem(CONSENT_KEY);
  return v === "accepted" || v === "declined" ? v : null;
}

export function setConsent(storage, value) {
  storage.setItem(CONSENT_KEY, value);
  if (value === "declined") {
    storage.removeItem(VID_KEY);
    storage.removeItem(SID_KEY);
  }
}

export function isOptedOut(storage) {
  return storage.getItem(OPTOUT_KEY) === "1";
}

function readEntry(storage, key) {
  try {
    const e = JSON.parse(storage.getItem(key));
    if (e && typeof e.id === "string" && e.id && Number.isFinite(e.ts)) return e;
  } catch {}
  return null;
}

export function getIds(storage, now, uuid) {
  let v = readEntry(storage, VID_KEY);
  if (!v || now - v.ts >= VISITOR_TTL) {
    v = { id: uuid(), ts: now };
    storage.setItem(VID_KEY, JSON.stringify(v));
  }
  let s = readEntry(storage, SID_KEY);
  if (!s || now - s.ts >= SESSION_TTL) s = { id: uuid(), ts: now };
  else s = { id: s.id, ts: now };
  storage.setItem(SID_KEY, JSON.stringify(s));
  return { visitorId: v.id, sessionId: s.id };
}

export function parseUtm(search) {
  const p = new URLSearchParams(search);
  const g = (k) => p.get("utm_" + k) || null;
  return {
    source: g("source"),
    medium: g("medium"),
    campaign: g("campaign"),
    term: g("term"),
    content: g("content"),
  };
}

// Share of the page the reader has seen: bottom of viewport over document height.
export function scrollPercent(scrollY, viewportH, docH) {
  if (!(docH > viewportH)) return 100;
  const pct = Math.round(((scrollY + viewportH) / docH) * 100);
  return Math.max(0, Math.min(100, pct));
}
