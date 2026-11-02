import { isIP } from "node:net";
import { parseUserAgent } from "./ua.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOOTER_LABELS = new Set(["github", "linkedin", "twitter", "instagram"]);
const EVENT_NAMES = new Set(["footer_click", "modal_open", "contact_submit"]);
const SAME_SITE_HOSTS = new Set(["rodneyboachie.com", "www.rodneyboachie.com", "ace-personal-site.vercel.app", "localhost"]);

const MAX_PATH = 512;
const MAX_REFERRER = 1024;
const MAX_FIELD = 256;
const MAX_ENGAGED_MS = 86_400_000;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(Math.round(v), 1_000_000)) : null);
const clamp = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(Math.round(v), hi)) : lo);

function dims(v) {
  const o = isObj(v) ? v : {};
  return { w: int(o.w), h: int(o.h) };
}

function consentIds(body) {
  if (body.consent !== true) return { consent: false };
  const out = { consent: true };
  if (isUuid(body.visitorId)) out.visitorId = body.visitorId.toLowerCase();
  if (isUuid(body.sessionId)) out.sessionId = body.sessionId.toLowerCase();
  return out;
}

// Returns a validated, size-limited payload, or null when invalid.
export function normalizePayload(body) {
  if (!isObj(body) || !isUuid(body.pageId)) return null;
  const pageId = body.pageId.toLowerCase();

  switch (body.type) {
    case "pageview": {
      if (typeof body.path !== "string" || body.path.length > MAX_PATH) return null;
      const utm = isObj(body.utm) ? body.utm : {};
      return {
        type: "pageview",
        pageId,
        path: body.path,
        referrer: str(body.referrer, MAX_REFERRER),
        utm: {
          source: str(utm.source, MAX_FIELD),
          medium: str(utm.medium, MAX_FIELD),
          campaign: str(utm.campaign, MAX_FIELD),
          term: str(utm.term, MAX_FIELD),
          content: str(utm.content, MAX_FIELD),
        },
        screen: dims(body.screen),
        viewport: dims(body.viewport),
        language: str(body.language, 35),
        timezone: str(body.timezone, 64),
        ...consentIds(body),
      };
    }
    case "event": {
      if (!EVENT_NAMES.has(body.name)) return null;
      const out = { type: "event", pageId, name: body.name };
      if (body.name === "footer_click") {
        if (!FOOTER_LABELS.has(body.label)) return null;
        out.label = body.label;
      }
      return { ...out, ...consentIds(body) };
    }
    case "engagement":
      return {
        type: "engagement",
        pageId,
        engagedMs: clamp(body.engagedMs, 0, MAX_ENGAGED_MS),
        scrollPct: clamp(body.scrollPct, 0, 100),
      };
    default:
      return null;
  }
}

export function geoFromHeaders(headers) {
  const get = (name) => {
    const v = headers.get(name);
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    country: get("x-vercel-ip-country"),
    region: get("x-vercel-ip-country-region"),
    city: get("x-vercel-ip-city"),
  };
}

export function clientIp(headers) {
  const first = (headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return first || null;
}

function referrerDomain(referrer) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host && !SAME_SITE_HOSTS.has(host) ? host : null;
  } catch {
    return null;
  }
}

const nn = (v) => (v === "" || v === undefined ? null : v);

async function insertPageview(query, p, headers) {
  const ua = parseUserAgent(headers.get("user-agent") || "");
  const geo = geoFromHeaders(headers);
  const ip = p.consent === true ? clientIp(headers) : null;
  await query(
    `insert into pageviews (page_id, path, referrer, referrer_domain,
       utm_source, utm_medium, utm_campaign, utm_term, utm_content,
       country, region, city, device, browser, browser_version, os, os_version,
       screen_w, screen_h, viewport_w, viewport_h, language, timezone,
       visitor_id, session_id, ip)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     on conflict (page_id) do nothing`,
    [
      p.pageId, p.path, nn(p.referrer), referrerDomain(p.referrer),
      nn(p.utm.source), nn(p.utm.medium), nn(p.utm.campaign), nn(p.utm.term), nn(p.utm.content),
      geo.country, geo.region, geo.city, ua.device, nn(ua.browser), nn(ua.browserVersion), nn(ua.os), nn(ua.osVersion),
      p.screen.w, p.screen.h, p.viewport.w, p.viewport.h, nn(p.language), nn(p.timezone),
      p.consent === true ? p.visitorId ?? null : null,
      p.consent === true ? p.sessionId ?? null : null,
      ip && isIP(ip) ? ip : null,
    ],
  );
}

async function insertEvent(query, p) {
  const consented = p.consent === true;
  await query(
    "insert into events (page_id, name, label, visitor_id, session_id) values ($1,$2,$3,$4,$5)",
    [p.pageId, p.name, p.label ?? null, consented ? p.visitorId ?? null : null, consented ? p.sessionId ?? null : null],
  );
}

async function updateEngagement(query, p) {
  await query(
    `update pageviews set engaged_ms = greatest(engaged_ms, $1), max_scroll_pct = greatest(max_scroll_pct, $2)
     where page_id = $3`,
    [p.engagedMs, p.scrollPct, p.pageId],
  );
}

// Persists an already-normalised payload. Throws on DB errors (caller logs).
export async function recordHit(query, payload, ctx) {
  switch (payload.type) {
    case "pageview": return insertPageview(query, payload, ctx.headers);
    case "event": return insertEvent(query, payload);
    case "engagement": return updateEngagement(query, payload);
  }
}
