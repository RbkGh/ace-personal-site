import { COOKIE_NAME, SESSION_TTL_MS, safeEqual, signSession } from "../../lib/session.js";

const WRONG_PASSWORD_DELAY_MS = 500;
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

export function createLoginHandler({ env, now = Date.now, sleep = sleepMs }) {
  return async function handler(request) {
    if (!env.DASHBOARD_PASSWORD || !env.SESSION_SECRET) {
      return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    let password;
    try { password = (await request.json())?.password; } catch { /* treated as missing */ }
    const ok = typeof password === "string" && safeEqual(password, env.DASHBOARD_PASSWORD);
    if (!ok) {
      await sleep(WRONG_PASSWORD_DELAY_MS);
      return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const token = signSession(env.SESSION_SECRET, now());
    const maxAge = SESSION_TTL_MS / 1000;
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
      },
    });
  };
}

export const POST = createLoginHandler({ env: process.env });
