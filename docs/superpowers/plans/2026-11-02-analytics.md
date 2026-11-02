# Site Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three independent analytics sources (Vercel Web Analytics, GA4, and a self-owned tracker + Postgres + private dashboard) to rodneyboachie.com, with a consent banner, privacy page, and README, without the site ever depending on analytics working.

**Architecture:** The public site stays static HTML. Analytics lives in separate ES-module files under `/analytics/` (client) that the page loads with `type="module"`, so failures can't touch the existing inline site script. The owned tracker posts to Vercel Node functions under `/api/`, which write to Neon Postgres through a tiny `query(text, params) → rows` adapter; all server logic is in `lib/` as pure or adapter-injected functions so it's testable against in-process Postgres (PGlite). The dashboard is served by a function at `/dashboard` that returns either a login page or the dashboard page depending on a signed cookie.

**Tech Stack:** Node 24, Vercel Node functions (Web `Request`/`Response` handlers: `export async function GET/POST(request)`), `@neondatabase/serverless`, Postgres; tests: `node:test`, `@electric-sql/pglite` (in-process Postgres), `@playwright/test` (resilience e2e). No framework, no bundler.

**Spec:** `docs/superpowers/specs/2026-11-01-analytics-design.md`

## Global Constraints

- Site must keep fully working (render, theme toggle, "Let's talk" modal, contact form, footer links) if any analytics part fails: blocked scripts, function errors, DB down, missing env vars, missing GA4 ID.
- Analytics code never goes inside the existing inline `<script>` in `index.html`; the only site-script change allowed is dispatching `document.dispatchEvent(new CustomEvent("ace:contact-submitted"))` on successful Formspree response.
- Never store or send contact-form contents (name/email/message) to any analytics source.
- GA4 loads only after consent = accepted **and** a non-empty measurement ID.
- Declined / undecided: no visitor ID, no session ID, no IP stored; geo from Vercel headers still recorded.
- Accepted: visitor ID (1 year), session ID (30 min inactivity), IP stored.
- Full IPs anonymised after 90 days (IPv4 → /24, IPv6 → /48) by a daily cron. Everything else kept forever.
- Collect endpoint writes only when `VERCEL_ENV` is `production` or `development`; always answers `204` quickly (DB timeout 1500 ms); logs errors with `console.error`.
- Dashboard: page and data both require valid signed cookie `ace_dash` (HMAC-SHA256 with `SESSION_SECRET`, 7-day expiry, `HttpOnly; Secure; SameSite=Strict; Path=/`); `noindex`; not linked anywhere; not tracked.
- Owner opt-out: `localStorage["ace_analytics_optout"] === "1"` disables the owned tracker and GA4 on that browser; set by the dashboard page after login.
- Dashboard date bucketing timezone: constant `DASHBOARD_TZ = "UTC"` in `lib/stats.js`.
- Env vars: `DATABASE_URL`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`. GA4 ID lives in `analytics/config.js` as `GA_MEASUREMENT_ID` (empty string = disabled).
- Visual style: reuse the site's CSS variables (`--bg`, `--fg`, copper accent `#c9754a`) and respect `data-theme` light/dark.
- Allowed origins for collect: `https://rodneyboachie.com`, `https://www.rodneyboachie.com`, `https://ace-personal-site.vercel.app`, `http://localhost:*`. If `Origin` is absent, fall back to the `Referer` host against the same list; neither present → reject.
- Allowed events: `footer_click` with label `github|linkedin|twitter|instagram`; `modal_open`; `contact_submit`.

## Review Focus

1. **Collect endpoint hit with garbage** (oversized body, invalid JSON, unknown event names, foreign origin, bot UA) → `204`, nothing written. Pinned in Task 3.
2. **Database unreachable or slow** → collect still returns `204` within ~1.5 s; dashboard data returns `503` JSON and the dashboard shows an error message instead of a blank page. Pinned in Tasks 3 and 6.
3. **Engagement beacon for a page_id that doesn't exist, or sent twice** → no error, values only ever increase (`GREATEST`). Pinned in Task 2.
4. **Visitor clears consent from Accepted to Declined** → visitor/session IDs are deleted from storage and subsequent hits carry none. Pinned in Task 4.
5. **Dashboard cookie tampered or expired, or wrong password** → login page / `401`, never data; password compare is constant-time. Pinned in Task 5.

---

## File Structure

```
package.json                 scripts + deps ("type": "module")
.gitignore                   node_modules, .env, .vercel, test-results
.env.example                 the four env vars, blank
vercel.json                  cleanUrls, /dashboard rewrite, cron
db/schema.sql                tables + indexes (idempotent)
scripts/migrate.js           applies db/schema.sql to DATABASE_URL
lib/db.js                    makeQuery() → neon adapter; withTimeout()
lib/ua.js                    parseUserAgent(), isBot()
lib/collect.js               validate + normalise payloads; insert/update rows
lib/session.js               sign/verify dashboard cookie; safeEqual()
lib/stats.js                 getStats(query, range)
lib/retention.js             anonymizeOldIps(query)
api/collect.js               POST handler
api/dashboard-page.js        GET (login or dashboard HTML) — served at /dashboard
api/dashboard/login.js       POST password → cookie
api/dashboard/data.js        GET stats JSON
api/cron/anonymize-ips.js    GET, cron-authorised
analytics/config.js          GA_MEASUREMENT_ID
analytics/lib.js             pure client helpers
analytics/consent.js         banner, consent state, GA4 loader
analytics/tracker.js         owned tracker + event hooks
dashboard/login.html         login page template
dashboard/app.html           dashboard page template (inline CSS/JS, fetches data)
privacy.html                 privacy page
index.html                   (modify) script tags, footer link, custom event, data-analytics attrs
sitemap.xml                  (modify) add /privacy
README.md                    setup + operations
tests/helpers/pg.js          freshDb() → PGlite with schema applied, query adapter
tests/*.test.js              unit/integration tests (node --test)
tests/e2e/server.js          static server + failing /api stubs
tests/e2e/resilience.spec.js Playwright
playwright.config.js
```

---

### Task 1: Project scaffolding, schema, test DB helper

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `db/schema.sql`, `scripts/migrate.js`, `lib/db.js`, `tests/helpers/pg.js`, `tests/schema.test.js`

**Interfaces:**
- Produces:
  - `type Query = (text: string, params?: any[]) => Promise<object[]>`
  - `lib/db.js`: `makeQuery(databaseUrl: string): Query` (uses `neon(url).query`), `withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>` (rejects with `Error("timeout")`)
  - `tests/helpers/pg.js`: `freshDb(): Promise<{ query: Query, close(): Promise<void> }>`
  - Tables:
    - `pageviews(id bigserial pk, page_id uuid unique not null, created_at timestamptz default now(), path text, referrer text, referrer_domain text, utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text, country text, region text, city text, device text, browser text, browser_version text, os text, os_version text, screen_w int, screen_h int, viewport_w int, viewport_h int, language text, timezone text, visitor_id uuid, session_id uuid, ip inet, ip_anonymized boolean default false, engaged_ms int default 0, max_scroll_pct smallint default 0)`
    - `events(id bigserial pk, created_at timestamptz default now(), page_id uuid, name text not null, label text, visitor_id uuid, session_id uuid)`
    - indexes on `pageviews(created_at)`, `events(created_at)`, `pageviews(created_at) where ip is not null and not ip_anonymized`
  - npm scripts: `test` = `node --test tests/`, `test:e2e` = `playwright test`, `db:migrate` = `node scripts/migrate.js`

- [ ] **Step 1:** Create `package.json` (`"type": "module"`, `"private": true`, engines node ≥ 20), deps `@neondatabase/serverless`; devDeps `@electric-sql/pglite`, `@playwright/test`. `.gitignore`: `node_modules/ .env .vercel/ test-results/ playwright-report/`. `.env.example` with the four env var names, blank. Run `npm install`.
- [ ] **Step 2: Write failing test** `tests/schema.test.js`:
  - `schema applies twice without error` — call `freshDb()`, then run `db/schema.sql` again via `query`; no throw.
  - `pageviews defaults` — insert `{page_id}` only; row has `engaged_ms === 0`, `max_scroll_pct === 0`, `ip_anonymized === false`, `created_at` set.
- [ ] **Step 3:** Run `npm test` → FAIL (no schema/helper).
- [ ] **Step 4:** Write `db/schema.sql` (all `IF NOT EXISTS`), `tests/helpers/pg.js` (PGlite, executes schema with `exec`, adapter returns `.rows`), `lib/db.js`, `scripts/migrate.js` (reads `DATABASE_URL`, runs schema statements via neon; exits non-zero with a clear message if unset).
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `chore: scaffold analytics project, schema and test db`.

---

### Task 2: Server-side collect logic (UA parsing, validation, persistence)

**Files:**
- Create: `lib/ua.js`, `lib/collect.js`, `tests/ua.test.js`, `tests/collect.test.js`

**Interfaces:**
- Consumes: `Query`, `freshDb()` (Task 1)
- Produces:
  - `lib/ua.js`: `parseUserAgent(ua: string): { device: "desktop"|"mobile"|"tablet"|"unknown", browser, browserVersion, os, osVersion }`, `isBot(ua: string): boolean`
  - `lib/collect.js`:
    - `normalizePayload(body: unknown): Pageview | Event | Engagement | null` — returns `null` if invalid
      - `Pageview = { type:"pageview", pageId, path, referrer, utm:{source,medium,campaign,term,content}, screen:{w,h}, viewport:{w,h}, language, timezone, consent:boolean, visitorId?, sessionId? }`
      - `Event = { type:"event", pageId, name, label?, consent, visitorId?, sessionId? }`
      - `Engagement = { type:"engagement", pageId, engagedMs, scrollPct }`
    - `geoFromHeaders(headers: Headers): { country, region, city }` (`x-vercel-ip-country`, `x-vercel-ip-country-region`, `x-vercel-ip-city` URI-decoded)
    - `clientIp(headers: Headers): string|null` (first entry of `x-forwarded-for`)
    - `recordHit(query: Query, payload, ctx: { headers: Headers }): Promise<void>`

- [ ] **Step 1: Write failing tests** `tests/ua.test.js`:
  - Chrome on macOS UA → `{device:"desktop", browser:"Chrome", os:"macOS"}` with non-empty versions.
  - Safari on iPhone → `device:"mobile"`, `browser:"Safari"`, `os:"iOS"`.
  - iPad UA → `device:"tablet"`.
  - Firefox on Windows, Edge on Windows (`Edg/` must report `Edge`, not Chrome), Samsung Internet on Android.
  - `isBot` true for `Googlebot`, `bingbot`, `HeadlessChrome`, `curl/8`, empty string; false for the browser UAs above.
- [ ] **Step 2: Write failing tests** `tests/collect.test.js` (use `freshDb()`):
  - `normalizePayload` returns `null` for: non-object, unknown `type`, missing/invalid UUID `pageId`, event name not in allowlist, `footer_click` with label not in `github|linkedin|twitter|instagram`, path > 512 chars.
  - Strips `visitorId`/`sessionId` when `consent !== true`.
  - Truncates strings: referrer ≤ 1024, utm fields ≤ 256; clamps `scrollPct` to 0–100 and `engagedMs` to 0–86_400_000.
  - `recordHit` pageview with consent=false → row has `visitor_id`, `session_id`, `ip` all null; country/region/city from headers (`x-vercel-ip-city: S%C3%A3o%20Paulo` → `São Paulo`); `referrer_domain` = host of referrer, `null` for same-site referrers (`rodneyboachie.com`, `www.rodneyboachie.com`).
  - `recordHit` pageview with consent=true and `x-forwarded-for: 203.0.113.7, 10.0.0.1` → `ip = 203.0.113.7`, IDs stored.
  - `recordHit` event → row in `events` with name/label.
  - Engagement on existing page_id twice (`5000/40` then `3000/70`) → `engaged_ms = 5000`, `max_scroll_pct = 70` (GREATEST each). Engagement for unknown page_id → resolves, no rows changed.
  - Duplicate pageview with same `pageId` → resolves, still one row (`ON CONFLICT DO NOTHING`).
- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4:** Implement `lib/ua.js` (hand-rolled regexes, no dependency; order matters: bots → Edge → Samsung → Opera → Chrome → Firefox → Safari) and `lib/collect.js` (parameterised SQL only).
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat: server-side collect logic`.

---

### Task 3: `/api/collect` endpoint

**Files:**
- Create: `api/collect.js`, `tests/api-collect.test.js`

**Interfaces:**
- Consumes: `normalizePayload`, `recordHit`, `isBot` (Task 2); `makeQuery`, `withTimeout` (Task 1)
- Produces: `createCollectHandler({ getQuery: () => Query|null, env: object, log?: fn }): (request: Request) => Promise<Response>`; `export const POST = createCollectHandler({ getQuery: () => process.env.DATABASE_URL ? makeQuery(process.env.DATABASE_URL) : null, env: process.env })`

- [ ] **Step 1: Write failing tests** (handler built with PGlite `query`, `env.VERCEL_ENV="production"`):
  - Valid pageview from `Origin: https://rodneyboachie.com` → `204`, one row.
  - Each of these → `204` and zero rows: body > 4096 bytes; invalid JSON; `Origin: https://evil.example`; UA `Googlebot/2.1`; `env.VERCEL_ENV="preview"`; `getQuery` returns `null`.
  - `Origin: http://localhost:3000` accepted.
  - `Referer: https://rodneyboachie.com/` with no `Origin` → accepted; neither header → `204`, zero rows.
  - `getQuery` returns a query that rejects → `204`, `log` called once.
  - `getQuery` returns a query that never resolves → response arrives in < 2000 ms with `204`.
  - Response has `Cache-Control: no-store`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement. Read body as text (accepts `text/plain` from `sendBeacon`), check size, parse, normalise, `withTimeout(recordHit(...), 1500)`, catch everything → `204`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: /api/collect endpoint`.

---

### Task 4: Client — consent banner, GA4 loader, owned tracker

**Files:**
- Create: `analytics/config.js`, `analytics/lib.js`, `analytics/consent.js`, `analytics/tracker.js`, `tests/client-lib.test.js`
- Modify: `index.html` — add before `</body>`:
  ```html
  <script defer src="/_vercel/insights/script.js"></script>
  <script type="module" src="/analytics/consent.js"></script>
  <script type="module" src="/analytics/tracker.js"></script>
  ```
  add `data-analytics="github|linkedin|twitter|instagram"` to the four footer `<a>`s; add `<a href="/privacy">Privacy</a>` to the footer after the PSN span; in the existing Formspree success branch add `document.dispatchEvent(new CustomEvent("ace:contact-submitted"));` (only change to the site script).

**Interfaces:**
- Consumes: `/api/collect` payload shapes (Task 2)
- Produces:
  - `analytics/config.js`: `export const GA_MEASUREMENT_ID = "";`
  - `analytics/lib.js` (pure, no DOM at import):
    - `CONSENT_KEY = "ace_consent"`, `OPTOUT_KEY = "ace_analytics_optout"`, `VID_KEY = "ace_vid"`, `SID_KEY = "ace_sid"`
    - `getConsent(storage): "accepted"|"declined"|null`
    - `setConsent(storage, value)` — on `"declined"` also removes `VID_KEY` and `SID_KEY`
    - `isOptedOut(storage): boolean`
    - `getIds(storage, now: number, uuid: () => string): { visitorId, sessionId }` — visitor: reuse if < 365 days old; session: reuse if last activity < 30 min, else new; stores `{id, ts}` JSON; updates session `ts` to `now`
    - `parseUtm(search: string): {source,medium,campaign,term,content}` (missing → `null`)
    - `scrollPercent(scrollY, viewportH, docH): number` (0–100, integer; page shorter than viewport → 100)
  - `window` event `ace:consent` (`detail: "accepted"|"declined"`) dispatched by `consent.js` on choice; `tracker.js` reads consent at send time.
  - `window.aceConsent.open()` — reopens banner (used by privacy page).

- [ ] **Step 1: Write failing tests** `tests/client-lib.test.js` (fake storage object implementing `getItem/setItem/removeItem`):
  - `getConsent` null on empty; round-trips both values; garbage value → null.
  - `setConsent(s,"declined")` after ids exist → `ace_vid` and `ace_sid` removed.
  - `getIds` same visitor & session within 29 min; new session after 31 min with same visitor; new visitor after 366 days.
  - `parseUtm("?utm_source=linkedin&utm_campaign=launch")` → `{source:"linkedin", medium:null, campaign:"launch", term:null, content:null}`.
  - `scrollPercent(0, 800, 800) === 100`; `scrollPercent(0, 800, 1600) === 50`; `scrollPercent(800, 800, 1600) === 100`.
  - `isOptedOut` true only for `"1"`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `analytics/lib.js`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Implement `analytics/consent.js`: whole module body in `try/catch`; renders banner (fixed bottom, small, site variables, light/dark aware) only if `getConsent` is null; text: *"I use cookies to understand how people find this site. Anonymous visit counts are recorded either way."* + link "Privacy" → `/privacy`, buttons **Accept** / **Decline**; on choice: `setConsent`, remove banner, dispatch `ace:consent`, load GA if accepted. `loadGA()`: no-op if `GA_MEASUREMENT_ID` empty, opted out, or already loaded; injects `https://www.googletagmanager.com/gtag/js?id=…` async + `gtag('config', id)`. Expose `window.aceConsent = { open }`.
- [ ] **Step 6:** Implement `analytics/tracker.js`: everything in `try/catch`; exit immediately if `isOptedOut` or path starts with `/dashboard`; `pageId = crypto.randomUUID()` (memory only); send pageview on load; delegated click listener for `[data-analytics]` → `footer_click`, `#openModalBtn` click → `modal_open`, `ace:contact-submitted` → `contact_submit`; each event also `window.gtag?.("event", name, { label })`; track engaged time (visible time only, via `visibilitychange`) and max scroll; on `pagehide` send engagement once. Send = `navigator.sendBeacon("/api/collect", JSON.stringify(p))`, fallback `fetch(..., {method:"POST", keepalive:true, body}).catch(()=>{})`. IDs included only when consent is `"accepted"`.
- [ ] **Step 7: Manual check** with `npx vercel dev` (or `npx serve .` for client-only): banner appears; Accept → GA not requested while ID empty; Network tab shows `/api/collect` pageview, click on GitHub link sends `footer_click`, closing tab sends `engagement`; reload → no banner.
- [ ] **Step 8:** Commit `feat: consent banner, GA4 loader and owned tracker`.

---

### Task 5: Dashboard auth (session cookie, login endpoint, gated page)

**Files:**
- Create: `lib/session.js`, `api/dashboard/login.js`, `api/dashboard-page.js`, `dashboard/login.html`, `vercel.json`, `tests/session.test.js`, `tests/api-dashboard-auth.test.js`

**Interfaces:**
- Produces:
  - `lib/session.js`: `signSession(secret: string, now: number): string` (`<expiryMs>.<hex hmac>`), `verifySession(token: string|undefined, secret: string, now: number): boolean`, `safeEqual(a: string, b: string): boolean` (`crypto.timingSafeEqual` on SHA-256 digests), `readCookie(headers: Headers, name: string): string|undefined`, `SESSION_TTL_MS = 7*24*3600*1000`, `COOKIE_NAME = "ace_dash"`
  - `createLoginHandler({ env, now? })` → `POST` handler: JSON `{password}`; correct → `204` + `Set-Cookie: ace_dash=…; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`; wrong/missing → `401` after ~500 ms delay; env vars missing → `503`
  - `createDashboardPageHandler({ env, readFile, now? })` → `GET`: valid cookie → `dashboard/app.html`; else `dashboard/login.html`. Both with `X-Robots-Tag: noindex`, `Cache-Control: no-store`.
  - `requireSession(request, env, now): boolean` (used by Task 6)
  - `vercel.json`: `{"cleanUrls": true, "rewrites":[{"source":"/dashboard","destination":"/api/dashboard-page"}], "crons":[{"path":"/api/cron/anonymize-ips","schedule":"0 3 * * *"}], "functions": {"api/dashboard-page.js": {"includeFiles": "dashboard/**"}}}`

- [ ] **Step 1: Write failing tests:**
  - `verifySession(signSession(s, t), s, t+1000)` true; false after `SESSION_TTL_MS + 1`; false with other secret; false for tampered expiry; false for `undefined`/`""`/`"abc"`.
  - `safeEqual("a","a")` true, `("a","b")` false, different lengths false.
  - Login: right password → `204` with cookie flags listed above; wrong → `401`, no `Set-Cookie`; missing `DASHBOARD_PASSWORD` or `SESSION_SECRET` → `503`.
  - Page: no cookie → body contains `id="login-form"`; valid cookie → body contains `id="dashboard-root"`; tampered cookie → login; response has `X-Robots-Tag: noindex`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `lib/session.js`, both handlers, `vercel.json`, and `dashboard/login.html` (site styles, password field `id="login-form"`, POSTs JSON via `fetch` to `/api/dashboard/login`, reloads on 204, shows "Wrong password" on 401; `<meta name="robots" content="noindex">`). Create a stub `dashboard/app.html` containing `<div id="dashboard-root"></div>` (filled in Task 6).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: dashboard login and gated page`.

---

### Task 6: Dashboard data API and dashboard page

**Files:**
- Create: `lib/stats.js`, `api/dashboard/data.js`, `tests/stats.test.js`, `tests/api-dashboard-data.test.js`
- Modify: `dashboard/app.html`

**Interfaces:**
- Consumes: `Query`, `freshDb()`, `withTimeout` (Task 1); `requireSession` (Task 5)
- Produces:
  - `lib/stats.js`: `DASHBOARD_TZ = "UTC"`; `RANGES = { today, "7d", "30d", all }`; `getStats(query: Query, range: keyof RANGES, now?: Date): Promise<Stats>` where
    `Stats = { range, totals:{views, visitors, sessions}, series:[{day:"YYYY-MM-DD", views, visitors}], referrers:[{domain, views}], campaigns:[{source, medium, campaign, views}], countries:[{country, views}], cities:[{country, region, city, views}], devices:[{device, views}], browsers:[{browser, views}], os:[{os, views}], events:[{name, label, count}], engagement:{avgEngagedMs, avgScrollPct}, recent:[{created_at, path, referrer_domain, country, city, device, browser, os, ip, utm_campaign}] }` — lists top 20 desc; `recent` latest 50 regardless of range; `visitors` = distinct non-null `visitor_id`.
  - `createDataHandler({ getQuery, env, now? })` → `GET ?range=` : no session → `401`; bad range → `400`; DB error/timeout (5000 ms) → `503 {"error":"database_unavailable"}`; ok → `200` JSON, `Cache-Control: no-store`.

- [ ] **Step 1: Write failing tests** `tests/stats.test.js` (seed fixed rows with explicit `created_at`, `now = 2026-11-02T12:00Z`):
  - 3 views today (2 with same visitor, 1 anonymous), 2 views 5 days ago, 1 view 40 days ago → `today` views 3 / visitors 1; `7d` views 5; `30d` views 5; `all` views 6.
  - `series` for `7d` has 7 entries, zero-filled days.
  - referrers grouped by `referrer_domain`, `null` excluded; events grouped by name+label; `avgScrollPct` averages only rows with engagement > 0.
  - `recent` length ≤ 50, newest first, includes `ip`.
- [ ] **Step 2:** Data handler tests: `401` without cookie; `400` for `range=year`; `503` when query rejects; `200` with `totals` key for valid cookie.
- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4:** Implement `lib/stats.js` (SQL with `AT TIME ZONE $tz`, `generate_series` for zero-fill) and `api/dashboard/data.js`.
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Build `dashboard/app.html`: on load sets `localStorage.ace_analytics_optout = "1"`; range tabs (Today / 7 days / 30 days / All time); stat tiles (views, visitors with caption "unique visitors among those who accepted cookies", sessions, avg engaged time, avg scroll); inline-SVG bar/line chart for `series` (no library); tables for referrers, campaigns, countries, cities, devices, browsers, OS, events; recent-visits table with IP; "Download CSV" for the recent table (client-side); on `401` reload (shows login), on `503`/network error show "Analytics database unavailable — the public site is unaffected." Site CSS variables + light/dark.
- [ ] **Step 7: Manual check:** `vercel dev` with real or local Postgres, log in, switch ranges, confirm numbers match seeded data and error state appears with a bad `DATABASE_URL`.
- [ ] **Step 8:** Commit `feat: dashboard data api and page`.

---

### Task 7: IP anonymisation cron

**Files:**
- Create: `lib/retention.js`, `api/cron/anonymize-ips.js`, `tests/retention.test.js`

**Interfaces:**
- Produces: `anonymizeOldIps(query: Query, now?: Date): Promise<number>` (rows updated); `createCronHandler({ getQuery, env })` → `GET`: requires `Authorization: Bearer ${CRON_SECRET}` else `401`; returns `200 {"anonymized": n}`; DB error → `500` + `console.error`.

- [ ] **Step 1: Write failing tests:**
  - IPv4 `203.0.113.77` 91 days old → `203.0.113.0`, `ip_anonymized = true`; 89 days old → unchanged.
  - IPv6 `2001:db8:abcd:12:3456::1` 91 days old → `2001:db8:abcd::`.
  - Already-anonymised rows not counted on second run (returns 0).
  - Cron handler: no/incorrect bearer → `401`; correct → `200` with count.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement: `UPDATE pageviews SET ip = host(network(set_masklen(ip, CASE WHEN family(ip)=4 THEN 24 ELSE 48 END)))::inet, ip_anonymized = true WHERE ip IS NOT NULL AND NOT ip_anonymized AND created_at < $1 - interval '90 days'`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: daily IP anonymisation cron`.

---

### Task 8: Privacy page

**Files:**
- Create: `privacy.html`
- Modify: `sitemap.xml` (add `https://rodneyboachie.com/privacy`, `lastmod` = ship date, `changefreq` yearly, priority 0.3)

- [ ] **Step 1:** Draft `privacy.html` in the site's style (same head meta pattern, canonical `https://rodneyboachie.com/privacy`, theme script, back link to `/`), loading the same three analytics scripts. Sections: *What's collected* (Vercel Web Analytics; GA4 after Accept; Rodney's own tracker), *If you decline* (anonymous page views, clicks, time on page, scroll, approximate location from country/region/city — no identifiers, no IP, no Google Analytics), *If you accept* (adds a visitor and session identifier stored in your browser, your IP address, and Google Analytics), *How long* (IP anonymised after 90 days; other data kept), *Contact form* (sent to Formspree, never part of analytics), *Your choice* — button `Change cookie choice` calling `window.aceConsent?.open()`; plain-text fallback if the script isn't available.
- [ ] **Step 2: STOP — show the full copy to Rodney and get approval.** Apply his edits. Do not commit unapproved copy.
- [ ] **Step 3:** Verify locally: `/privacy` renders in light and dark; button reopens banner; footer link from home works.
- [ ] **Step 4:** Commit `feat: privacy page`.

---

### Task 9: Resilience e2e test

**Files:**
- Create: `playwright.config.js`, `tests/e2e/server.js`, `tests/e2e/resilience.spec.js`

**Interfaces:**
- `tests/e2e/server.js`: `node tests/e2e/server.js` serves repo root on port 4173 (`/privacy` → `privacy.html`), and answers every `/api/*` with `500` after a 3 s delay (simulates broken backend).
- Playwright `webServer` starts it; chromium only.

- [ ] **Step 1: Write tests** (each scenario runs the same assertions: page title shows; clicking "Dark" sets `data-theme="dark"`; clicking "Let's talk" makes `#modalBackdrop` `.active`; Escape closes it; footer links have correct `href`s; no uncaught page errors from site code):
  - `analytics scripts blocked` — `page.route(/\/analytics\/|_vercel\/insights|googletagmanager/, r => r.abort())`; also assert no consent banner overlay blocks clicks.
  - `api failing slowly` — default server behaviour; assertions complete in < 2 s after load (nothing waits on `/api/collect`).
  - `analytics scripts throw` — `page.route(/\/analytics\/tracker\.js/, r => r.fulfill({ body: "throw new Error('boom')", contentType: "text/javascript" }))`; site still works.
  - `contact form succeeds with analytics blocked` — mock `formspree.io` → `200 {}`, fill form, submit, `#formStatus` contains "Message sent".
- [ ] **Step 2:** `npx playwright install chromium` then `npm run test:e2e` → PASS (fix site/analytics code if not).
- [ ] **Step 3:** Commit `test: resilience e2e for analytics failures`.

---

### Task 10: README

**Files:**
- Create: `README.md`

- [ ] **Step 1:** Write README with sections exactly as the spec's README list: Overview; Running locally (`npm install`, `cp .env.example .env`, `npx vercel link`, `npx vercel env pull .env`, `npx vercel dev`, `npm test`, `npm run test:e2e`); Analytics setup (Neon: create project → copy pooled connection string → `npm run db:migrate`; env vars table with purpose + generation: `openssl rand -hex 32` for `SESSION_SECRET` and `CRON_SECRET`; set via Vercel dashboard or `npx vercel env add NAME production`; enable Web Analytics in Vercel → Analytics tab; GA4: create property + web stream for `rodneyboachie.com`, paste `G-…` into `analytics/config.js`, deploy; cron: Vercel → Settings → Cron Jobs, logs; dashboard: `/dashboard`, opt-out behaviour); Operating it (export: `pg_dump "$DATABASE_URL" > backup.sql` and dashboard CSV; rotate password: change env var + redeploy, rotate `SESSION_SECRET` to log out everywhere; disable a source: empty `GA_MEASUREMENT_ID` / remove Vercel script tag / remove `DATABASE_URL`; resilience summary); Troubleshooting (no data: check `VERCEL_ENV`, origin allowlist, function logs, opt-out flag in your own browser; login fails: env vars set for Production + redeploy; cron: `CRON_SECRET` set, Hobby plan runs once daily).
- [ ] **Step 2:** Verify every command and path in the README exists in the repo (`npm run` scripts, file paths, env names match `.env.example`).
- [ ] **Step 3:** Commit `docs: README with analytics setup and operations`.

---

### Task 11: Provision and deploy

Rodney does anything involving passwords/secrets; Claude may drive Neon/Vercel/GA4 UIs in Chrome for non-secret steps with his go-ahead.

- [ ] **Step 1:** Rodney (or Claude via Chrome) creates Neon project `ace-personal-site` (region nearest Vercel function region, default `iad1`), copies pooled connection string.
- [ ] **Step 2:** Rodney sets Production env vars in Vercel: `DATABASE_URL`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`.
- [ ] **Step 3:** Run `DATABASE_URL=… npm run db:migrate` (Rodney runs with `!` prefix so the URL isn't echoed into chat).
- [ ] **Step 4:** Enable Web Analytics in Vercel project.
- [ ] **Step 5:** Create GA4 property + web stream; put ID in `analytics/config.js`; commit `chore: set GA4 measurement id`.
- [ ] **Step 6:** Push to `main`; wait for deploy.
- [ ] **Step 7: Verify production:** `curl -sI https://rodneyboachie.com/dashboard` → `200` with `x-robots-tag: noindex`; visit site in a fresh browser profile, Accept → GA4 realtime shows the visit; Rodney logs into `/dashboard` and sees the visit with country/device; Vercel Analytics shows a page view (may lag minutes); Vercel → Cron Jobs lists `/api/cron/anonymize-ips`.
