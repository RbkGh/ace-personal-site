# Site Analytics — Design

Date: 2026-11-01
Site: https://rodneyboachie.com (static `index.html` on Vercel, project `ace-personal-site`, repo `RbkGh/ace-personal-site`)

## Intent

Rodney wants to understand who visits his personal site and how they got there — page views, traffic sources, countries, and as much other relevant detail as is reasonable.

He explicitly does **not** want to depend on a single analytics provider. The solution runs three independent sources in parallel, one of which he fully owns:

1. **Vercel Web Analytics** — zero-effort, built into the host.
2. **Google Analytics 4** — independent hosted provider (chosen by Rodney).
3. **Self-owned tracker** — first-party collection endpoint on his own site writing to a Postgres database he controls, viewed through a private dashboard on his site.

If any one provider disappears, changes pricing, or loses data, the other two still have it — and the owned copy is portable standard Postgres.

## Goals

- Record every page view with: timestamp, path, referrer (raw + parsed domain), UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`), country, region, city (from Vercel geo headers), device type, browser + version, OS + version, screen size, viewport size, language, timezone.
- Track unique visitors and sessions (only for visitors who consent; see Consent).
- Track engagement on the single page:
  - clicks on each footer link (GitHub, LinkedIn, Twitter, Instagram)
  - "Let's talk" modal opened
  - contact form submitted successfully (event only — **never** the form contents)
  - time on page (engaged time, sent on page hide)
  - max scroll depth (%)
- A private dashboard at a hidden URL on the site (e.g. `/dashboard`), password-protected, `noindex`, not linked anywhere, showing:
  - views + unique visitors for today / 7d / 30d / all time, with a time-series chart
  - top referrers and top UTM campaigns
  - countries (with city drill-down or city list)
  - device / browser / OS breakdowns
  - event counts (each footer link, modal opens, form submits)
  - average engaged time and scroll depth
  - a recent-visits feed (latest ~50 page views with their details)
- Data in the owned database is exportable (it's plain Postgres; a CSV export button on the dashboard is a nice-to-have, not required).

## Resilience requirement (Rodney's decision)

The website must keep working fully — page renders, theme toggle, "Let's talk" modal, contact form, footer links — even if analytics fails for any reason (provider outage, Neon down or out of quota, function errors, ad/tracker blockers, script load failures, slow networks, bad config such as a missing env var or GA4 ID). Concretely:

- **Isolation from site code:** analytics lives in its own separate script(s), loaded `async`/`defer`, never inline inside the existing site script. A thrown error, failed load, or blocked request in analytics cannot stop the site's own JavaScript from running. All analytics hooks into the page (click listeners, etc.) are wrapped so errors are swallowed.
- **Each source independent:** a failure in Vercel Analytics, GA4, or the owned tracker doesn't affect the other two.
- **No blocking:** nothing analytics-related is render-blocking or awaited by the page. Sends use `sendBeacon` / `fetch` with `keepalive` and are fire-and-forget; no retries that pile up.
- **Collect endpoint fails soft:** if the database is unreachable or the insert errors, the endpoint still responds quickly (e.g. `204`) and logs the error server-side; it never makes the visitor wait on the database beyond a short timeout.
- **Consent banner degrades gracefully:** if its script fails, the site is simply shown without a banner (and GA4 stays off) — never a broken or stuck overlay.
- **Dashboard isolated:** dashboard/API failures affect only `/dashboard`, never the public site.
- **Verified:** the plan must include a check that the site still works with analytics scripts blocked and with the database unavailable.

## Non-goals

- Multi-page tracking beyond what exists (site is one page; the tracker should still record `path` so it works if pages are added later, but no SPA routing support needed).
- Heatmaps, session recordings, A/B testing.
- Real-time live view.
- Multiple dashboard users / roles.
- Migrating historical data (there is none).

## Anti-goals (would be a failure even if it "works")

- Storing contact-form contents (name/email/message) in analytics — Formspree handles that, analytics only records that a submission happened.
- Visibly slowing the page or breaking it if any analytics source is down/blocked. All analytics loads async and fails silently.
- Exposing the dashboard or its data publicly (no unauthenticated API returning analytics data; dashboard not indexed).
- Changing the site's look beyond adding a small consent banner that matches the existing design (dark/light themes, copper accent `#c9754a`).
- Counting Rodney's own visits to the dashboard as site traffic.

## Consent

Rodney is fine with a consent banner. Behaviour:

- Small, unobtrusive banner matching site styles (respects the existing light/dark theme toggle), with **Accept** and **Decline**, one sentence of explanation, and a link to `/privacy`. Choice stored in `localStorage` and not asked again. The visitor can change their choice from the privacy page.
- **Before choice / Declined:**
  - Vercel Web Analytics runs (cookieless by design).
  - Self-owned tracker records anonymous page views and events: no visitor ID, no session ID, no IP stored. Geo (country/region/city) from Vercel headers is still recorded since it's derived server-side without storing the IP.
  - GA4 is **not** loaded.
- **Accepted:**
  - GA4 loads.
  - Self-owned tracker sets a first-party visitor ID (persistent, ~1 year) and session ID (expires after 30 min inactivity), enabling unique-visitor and session counts. IP address is stored.
- Unique-visitor numbers on the dashboard are therefore "among consenting visitors"; total views count everyone. The dashboard should label this.
- For declined visitors, engaged time and scroll depth are tied to their page view by a per-page-load ID held only in memory (never persisted in the browser). *(Claude's call.)*

## Data retention (Rodney's decision)

- Full IP addresses (consenting visitors only) are kept for **90 days**, then automatically anonymised (IPv4 truncated to /24, IPv6 to /48) by a daily scheduled job (Vercel Cron → function).
- Every other field of every visit and event is kept indefinitely.
- The recent-visits feed on the dashboard shows the IP (full or truncated, whatever is stored). *(Claude's call — it's a private, password-protected view.)*

## Privacy page (Rodney's decision)

- New page at `/privacy` in the site's existing visual style, linked from the consent banner and from the footer ("Privacy").
- Plainly explains: the three analytics sources (Vercel Web Analytics, Google Analytics 4, Rodney's own tracker); what's collected before/after consent, including that anonymous page views, events and approximate location are recorded even after Decline; that IPs are stored only after Accept and anonymised after 90 days; that contact-form contents go to Formspree and are never part of analytics; how to change the choice (a "Change cookie choice" control on the page that reopens the banner).
- Claude drafts the wording; **Rodney approves the copy** before it ships.
- Added to `sitemap.xml`; the page is tracked like any other page.

## How it's built (decided)

- **Hosting:** stays on Vercel. The owned tracker's endpoint and dashboard API are Vercel Serverless Functions under `/api/*` in this repo. The site remains static HTML with no framework/build step; a `package.json` is added only for function dependencies.
- **Owned database:** **Neon** (serverless Postgres, free tier). Connection string in Vercel environment variable (e.g. `DATABASE_URL`). Chosen because it's standard Postgres — portable to any host.
- **GA4:** standard `gtag.js`, measurement ID provided by Rodney (property to be created), loaded only after consent. Footer link clicks / modal / form submit also sent to GA4 as events.
- **Vercel Web Analytics:** enabled in the Vercel project dashboard + script tag (`/_vercel/insights/script.js`). Custom events in Vercel Analytics require a paid plan — not needed; Vercel only provides page views here.
- **Dashboard auth:** single password stored in a Vercel env var (e.g. `DASHBOARD_PASSWORD`). Login sets an HttpOnly, Secure, SameSite=Strict signed session cookie. Dashboard page and its data API reject requests without it.
- **Excluding own traffic:** dashboard visits aren't tracked; additionally, a successful dashboard login sets a flag in `localStorage` that tells the tracker (and GA4) to skip tracking on that browser.

## Rodney's setup tasks

- Create a Neon project/database (or let Claude do it via Chrome) and put the connection string into Vercel env vars.
- Create a GA4 property for rodneyboachie.com and provide the measurement ID (`G-XXXX`).
- Enable Web Analytics in the Vercel project.
- Choose the dashboard password (set it as an env var himself — Claude must not enter passwords).

## Settled by Claude after review (Rodney can override)

- **Dashboard protection:** both the dashboard page and its data API require the valid session cookie; an unauthenticated request to `/dashboard` gets the login form, never the dashboard markup/data.
- **Preview deployments** never write to the production database: the collect endpoint only writes when `VERCEL_ENV === "production"` (previews may no-op).
- **Dashboard "today"/date bucketing** uses UTC *(assumption — a single constant, easy to change to Rodney's local timezone)*.
- **Cookie signing secret:** separate env var `SESSION_SECRET` (random, generated during setup), distinct from the password.
- **GA4 measurement ID:** read from a single constant in the page; until Rodney provides it, GA4 stays disabled (no placeholder requests).

## Left to the builder

- Exact table schema (one `pageviews` table + one `events` table, or a single events table with a type column).
- User-agent parsing approach (small library or minimal hand-rolled parsing).
- Bot filtering (at minimum drop obvious bot user agents).
- Chart rendering on the dashboard (lightweight, no heavy framework; follows the site's visual language).
- Rate limiting / basic abuse protection on the collect endpoint (e.g. reject payloads that are too large or malformed; origin check).
- Use of `navigator.sendBeacon` vs `fetch(..., {keepalive:true})`.
- Whether the dashboard is a static `dashboard.html` calling a protected JSON API, or server-rendered by a function.
