import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "ace_dash";
export const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

const hmac = (secret, data) => createHmac("sha256", secret).update(data).digest("hex");
const digest = (s) => createHash("sha256").update(String(s)).digest();

export function safeEqual(a, b) {
  return timingSafeEqual(digest(a), digest(b));
}

export function signSession(secret, now) {
  const expiry = String(now + SESSION_TTL_MS);
  return `${expiry}.${hmac(secret, expiry)}`;
}

export function verifySession(token, secret, now) {
  if (!token || !secret || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expiry = token.slice(0, dot);
  if (!/^\d+$/.test(expiry)) return false;
  if (!safeEqual(token.slice(dot + 1), hmac(secret, expiry))) return false;
  return Number(expiry) >= now;
}

export function readCookie(headers, name) {
  const raw = headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

export function requireSession(request, env, now = Date.now()) {
  return verifySession(readCookie(request.headers, COOKIE_NAME), env.SESSION_SECRET, now);
}
