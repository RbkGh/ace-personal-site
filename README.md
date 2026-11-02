# rodneyboachie.com

Personal site for Rodney Boachie. A static `index.html` (plus `privacy.html`) served by Vercel, with a small set of serverless functions under `/api` that power first-party analytics and a private dashboard.

- Hosting: Vercel project `ace-personal-site`, domain `rodneyboachie.com`
- Repo: `RbkGh/ace-personal-site`
- Functions: `api/collect.js` (ingest), `api/dashboard-page.js` + `api/dashboard/{login,data}.js` (dashboard), `api/cron/anonymize-ips.js` (daily IP anonymisation)
- Database: Neon Postgres (schema in `db/schema.sql`)
- Analytics sources (each independent): Vercel Web Analytics, the self-owned tracker (`analytics/tracker.js`), and Google Analytics 4 (consent-gated, off until configured)

## Running locally

Needs Node 22 or newer for the tests (`node --test` globs) and a Vercel account with access to the project.

1. `npm install`
2. `cp .env.example .env` and fill it in (never commit `.env`; it is git-ignored).
3. `npx vercel link` (pick the `ace-personal-site` project).
4. Optional: `npx vercel env pull .env` to pull the project's env vars instead of filling them by hand.
5. `npx vercel dev` serves the static site and the `/api` functions.
6. `npm test` runs the unit and API tests (`node --test "tests/**/*.test.js"`). They use an in-memory Postgres (PGlite), so no database is needed.
7. `npm run test:e2e` runs the Playwright resilience tests. Run `npx playwright install chromium` once first, or set `PW_CHANNEL=chrome` to use an installed Chrome.

## Analytics setup

### 1. Neon database

1. Create a project at neon.tech.
2. Copy the **pooled** connection string (the host contains `-pooler`).
3. Export it and apply the schema:
   ```
   DATABASE_URL="postgres://..." npm run db:migrate
   ```
   (or put it in `.env` and `export $(cat .env | xargs)`). The script runs `db/schema.sql` and prints `Applied N statements.`

### 2. Environment variables

| Name | Purpose | How to get a value |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled Postgres connection string, used by collect, dashboard and cron | Neon dashboard |
| `DASHBOARD_PASSWORD` | Password for `/dashboard`. Use a long random one: login only has a small fixed delay, no lockout | `openssl rand -base64 24` |
| `SESSION_SECRET` | Signs the `ace_dash` login cookie (HMAC-SHA256, 7-day expiry) | `openssl rand -hex 32` |
| `CRON_SECRET` | Authenticates the daily cron call; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when it is set | `openssl rand -hex 32` |

Set them for Production (and Development if you use `vercel dev`):

- Dashboard: Vercel project, Settings, Environment Variables, or
- CLI: `npx vercel env add DATABASE_URL production` (repeat for each name), then redeploy.

The Google Analytics ID is not an env var; see step 4.

### 3. Vercel Web Analytics

In Vercel, open the project's **Analytics** tab and click Enable. `index.html` already includes `/_vercel/insights/script.js`. It is cookieless, so it runs before any consent choice.

### 4. Google Analytics 4

1. In Google Analytics, create a GA4 property and a web data stream for `rodneyboachie.com`.
2. Copy the measurement ID (`G-XXXXXXXXXX`).
3. Paste it into `GA_MEASUREMENT_ID` in `analytics/config.js` and deploy.

GA4 stays off while that string is empty, and even when set it only loads after a visitor clicks Accept on the consent banner.

### 5. IP-anonymisation cron

`vercel.json` schedules `/api/cron/anonymize-ips` at `0 3 * * *` (03:00 UTC daily). It masks stored IPs older than 90 days (IPv4 to /24, IPv6 to /48). The Hobby plan allows crons to run once a day, which is all this needs.

To check it: Vercel project, Settings, Cron Jobs (shows the job and lets you run it), and the Logs tab filtered to `/api/cron/anonymize-ips`. It requires `CRON_SECRET` to be set, otherwise it answers 401.

### 6. Dashboard

Visit `https://rodneyboachie.com/dashboard` and sign in with `DASHBOARD_PASSWORD`. The page is not linked anywhere, is `noindex`, and is not tracked. Any `/dashboard/*` path redirects to `/dashboard`.

After a successful login the dashboard sets `localStorage.ace_analytics_optout = "1"` in that browser, so your own visits are not counted by the tracker or GA4. To be counted again, clear it in the browser console: `localStorage.removeItem("ace_analytics_optout")`.

## Operating it

- **Export data:** `pg_dump "$DATABASE_URL" > backup.sql` for everything; the dashboard also has a CSV download of recent visits.
- **Rotate the dashboard password:** change `DASHBOARD_PASSWORD` in Vercel and redeploy. Existing sessions keep working until they expire; to log everyone out, also rotate `SESSION_SECRET` (this invalidates every `ace_dash` cookie).
- **Turn off one source:**
  - GA4: set `GA_MEASUREMENT_ID` to `""` in `analytics/config.js` and deploy.
  - Vercel Web Analytics: remove the `/_vercel/insights/script.js` tag from `index.html` (or disable it in the Analytics tab).
  - Own tracker/database: remove `DATABASE_URL` from Vercel and redeploy; collect then accepts hits and writes nothing.
- **When analytics is down:** the site is unaffected. All analytics scripts load async and fail silently; `/api/collect` always answers `204` quickly (1.5 s DB timeout) and logs errors with `console.error`; missing env vars or a blocked tracker or GA4 script never break rendering, the theme toggle, the contact modal or the form. `npm run test:e2e` covers these cases.
- **Consent model:** before a choice or after Decline, only anonymous page views/events are stored (no visitor ID, session ID or IP; geo from Vercel headers is kept). After Accept, a visitor ID (1 year), session ID (30 min inactivity) and IP are stored, and GA4 loads if configured.

## Troubleshooting

**No data arriving**
1. `/api/collect` only writes when `VERCEL_ENV` is `production` or `development`. Preview deployments accept hits but do not write.
2. Origin must be `https://rodneyboachie.com`, `https://www.rodneyboachie.com`, `https://ace-personal-site.vercel.app` or `http://localhost:*` (falls back to the Referer host if there is no Origin; neither present is rejected).
3. Check function logs in Vercel for `console.error` output (usually a bad `DATABASE_URL` or missing schema; run `npm run db:migrate`).
4. Check your own browser for the opt-out flag: `localStorage.getItem("ace_analytics_optout")`. Use a private window or clear it.
5. Ad blockers and Do Not Track settings can hide the Vercel script; that is expected.

**Dashboard login fails**
- Confirm `DASHBOARD_PASSWORD` and `SESSION_SECRET` are set for the Production environment, then redeploy (env var changes only apply to new deployments).
- Check the password has no stray whitespace.

**Cron not running or returning 401**
- Confirm `CRON_SECRET` is set for Production and redeployed.
- On the Hobby plan the cron runs once a day at 03:00 UTC; it will not run more often and timing within the hour is not exact.
- Check Settings, Cron Jobs and the function logs.
