# SEO Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `index.html` discoverable and correctly represented in search results and social previews, per `docs/superpowers/specs/2026-07-12-seo-optimization-design.md` — meta tags, Open Graph/Twitter Card, JSON-LD, favicon, `robots.txt`/`sitemap.xml`, and a generated social preview image — with zero changes to visible page content or existing verified behavior.

**Architecture:** All additions are static — inline `<head>` tags, a JSON-LD `<script>` block, a data-URI favicon, and two new plaintext/XML files at the repo root. The social preview image is generated once via headless Chromium (Playwright, same tool already used to verify this site) from a small standalone `og-image.html` source file that stays in the repo for future regeneration.

**Tech Stack:** Plain HTML/CSS (no JS added to the live page), Playwright for image generation and verification, `sips` (built into macOS) for PNG dimension checks, `python3`'s `xml.dom.minidom` for XML validation.

## Global Constraints

- No changes to visible page copy other than `<title>` and `<meta name="description">` (neither renders on the page itself).
- Canonical/OG/Twitter/JSON-LD URLs all use `https://rodneyboachie.tech/` exactly — no trailing-slash inconsistency.
- Title: `Ace (Rodney Boachie) — Experienced Software Engineer`
- Meta description / OG description / Twitter description (identical text): `Rodney Boachie (Ace) — experienced software engineer with 10+ years across backend, frontend, mobile, and DevOps. I build systems that don't stress under stress.`
- JSON-LD `jobTitle`: `Experienced Software Engineer`
- No DNS/hosting/deployment configuration changes.
- No new npm dependencies added to the repo itself — Playwright is used only as an external verification/generation tool (as in prior work on this project), not wired into the site.
- Favicon and OG image use the existing palette only: dark `#0d0d0f` background, copper accent (`#c9754a` light / `#d98b62` dark — OG image uses the dark-mode copper `#d98b62` since it's a fixed dark-themed card).

---

## Task 1: Core meta tags, Open Graph, Twitter Card, JSON-LD, and favicon

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: no new IDs/classes consumed by other tasks — this is head-only markup with no interaction surface.

- [ ] **Step 1: Replace the title and add all head tags**

In `index.html`, find this line:

```html
        <title>Ace — Software Engineer</title>
```

Replace it with:

```html
        <title>Ace (Rodney Boachie) — Experienced Software Engineer</title>
        <meta
            name="description"
            content="Rodney Boachie (Ace) — experienced software engineer with 10+ years across backend, frontend, mobile, and DevOps. I build systems that don't stress under stress."
        />
        <meta name="author" content="Rodney Boachie" />
        <link rel="canonical" href="https://rodneyboachie.tech/" />
        <meta name="theme-color" content="#c9754a" />
        <link
            rel="icon"
            type="image/svg+xml"
            href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230d0d0f'/%3E%3Ctext x='32' y='44' font-family='Arial, sans-serif' font-weight='700' font-size='34' fill='%23c9754a' text-anchor='middle'%3EA%3C/text%3E%3C/svg%3E"
        />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://rodneyboachie.tech/" />
        <meta
            property="og:title"
            content="Ace (Rodney Boachie) — Experienced Software Engineer"
        />
        <meta
            property="og:description"
            content="Rodney Boachie (Ace) — experienced software engineer with 10+ years across backend, frontend, mobile, and DevOps. I build systems that don't stress under stress."
        />
        <meta property="og:site_name" content="Ace" />
        <meta
            property="og:image"
            content="https://rodneyboachie.tech/og-image.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta
            name="twitter:title"
            content="Ace (Rodney Boachie) — Experienced Software Engineer"
        />
        <meta
            name="twitter:description"
            content="Rodney Boachie (Ace) — experienced software engineer with 10+ years across backend, frontend, mobile, and DevOps. I build systems that don't stress under stress."
        />
        <meta
            name="twitter:image"
            content="https://rodneyboachie.tech/og-image.png"
        />

        <script type="application/ld+json">
            {
                "@context": "https://schema.org",
                "@type": "Person",
                "name": "Rodney Boachie",
                "alternateName": "Ace",
                "jobTitle": "Experienced Software Engineer",
                "url": "https://rodneyboachie.tech/",
                "description": "Experienced software engineer with 10+ years across backend, frontend, mobile, and DevOps.",
                "sameAs": [
                    "https://github.com/rbkgh",
                    "https://linkedin.com/in/rodney-boachie",
                    "https://twitter.com/ace_rbk",
                    "https://instagram.com/ace_rbk"
                ]
            }
        </script>
```

- [ ] **Step 2: Verify the head tags via headless browser**

```bash
node -e "
const { chromium } = require('playwright');
const path = require('path');
const fileUrl = 'file://' + path.resolve('/Users/acerbk/AceProjs/general-mbappe-space/ace-personal-site/index.html');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(fileUrl);

  const get = (sel, attr) => page.\$eval(sel, (el, a) => el.getAttribute(a), attr).catch(() => null);

  console.log('title:', await page.title());
  console.log('description:', await get('meta[name=\"description\"]', 'content'));
  console.log('canonical:', await get('link[rel=\"canonical\"]', 'href'));
  console.log('theme-color:', await get('meta[name=\"theme-color\"]', 'content'));
  console.log('favicon href starts with data:image/svg+xml:', (await get('link[rel=\"icon\"]', 'href') || '').startsWith('data:image/svg+xml'));
  console.log('og:title:', await get('meta[property=\"og:title\"]', 'content'));
  console.log('og:image:', await get('meta[property=\"og:image\"]', 'content'));
  console.log('twitter:card:', await get('meta[name=\"twitter:card\"]', 'content'));

  const ldJsonText = await page.\$eval('script[type=\"application/ld+json\"]', (el) => el.textContent);
  const parsed = JSON.parse(ldJsonText);
  console.log('JSON-LD parsed ok, jobTitle:', parsed.jobTitle, 'sameAs count:', parsed.sameAs.length);

  console.log('console errors:', errors);
  await browser.close();
})();
"
```

Expected output:
- `title: Ace (Rodney Boachie) — Experienced Software Engineer`
- `description:` the full sentence specified in Step 1
- `canonical: https://rodneyboachie.tech/`
- `theme-color: #c9754a`
- `favicon href starts with data:image/svg+xml: true`
- `og:title:` same as title
- `og:image: https://rodneyboachie.tech/og-image.png`
- `twitter:card: summary_large_image`
- `JSON-LD parsed ok, jobTitle: Experienced Software Engineer sameAs count: 4`
- `console errors: []`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add SEO meta tags, Open Graph, Twitter Card, JSON-LD, and favicon"
```

---

## Task 2: Wrap main content in a `<main>` landmark

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: none.
- Produces: none — purely a semantic tag rename, no new selectors for other tasks.

- [ ] **Step 1: Replace the container div/close tags with `<main>`**

Find:

```html
        <div class="container">
            <div class="wordmark">
                ACE<span class="realname">Rodney Boachie</span>
            </div>
            <h1>I build systems that don't stress under stress.</h1>
            <p class="philosophy">
                Been architecting and cooking software since 2014 across
                backend, frontend, mobile, and infrastructure, that's the dig!
            </p>
            <button class="cta" id="openModalBtn">Let's talk →</button>
        </div>
```

Replace with:

```html
        <main class="container">
            <div class="wordmark">
                ACE<span class="realname">Rodney Boachie</span>
            </div>
            <h1>I build systems that don't stress under stress.</h1>
            <p class="philosophy">
                Been architecting and cooking software since 2014 across
                backend, frontend, mobile, and infrastructure, that's the dig!
            </p>
            <button class="cta" id="openModalBtn">Let's talk →</button>
        </main>
```

(No CSS change needed — the existing `.container` rule applies identically to a `<main>` element.)

- [ ] **Step 2: Verify the swap**

```bash
node -e "
const { chromium } = require('playwright');
const path = require('path');
const fileUrl = 'file://' + path.resolve('/Users/acerbk/AceProjs/general-mbappe-space/ace-personal-site/index.html');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(fileUrl);
  const mainExists = await page.evaluate(() => !!document.querySelector('main.container'));
  const oldDivGone = await page.evaluate(() => !document.querySelector('div.container'));
  const scrollInfo = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  console.log('main.container exists:', mainExists);
  console.log('div.container gone:', oldDivGone);
  console.log('vScroll:', scrollInfo.scrollHeight > scrollInfo.clientHeight + 1);
  console.log('console errors:', errors);
  await browser.close();
})();
"
```

Expected: `main.container exists: true`, `div.container gone: true`, `vScroll: false`, `console errors: []`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Wrap main content in a <main> landmark for SEO/accessibility"
```

---

## Task 3: Generate the social preview image

**Files:**
- Create: `og-image.html`
- Create: `og-image.png` (generated, not hand-written)

**Interfaces:**
- Produces: `og-image.png` at the repo root — Task 1's `og:image`/`twitter:image` meta tags already reference `https://rodneyboachie.tech/og-image.png`, so this task's output file must be named exactly `og-image.png` and placed at the repo root (sibling to `index.html`).

- [ ] **Step 1: Create `og-image.html`**

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>OG Image Source</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            html,
            body {
                width: 1200px;
                height: 630px;
                background: #0d0d0f;
                color: #f2f1ee;
                font-family:
                    -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI",
                    sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .card {
                text-align: center;
            }
            .wordmark {
                font-weight: 700;
                font-size: 28px;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: #f2f1ee;
            }
            .realname {
                display: block;
                font-weight: 400;
                font-size: 20px;
                color: #918f95;
                margin-top: 6px;
            }
            h1 {
                font-size: 56px;
                font-weight: 700;
                line-height: 1.15;
                margin: 40px 0 0;
                max-width: 900px;
                color: #f2f1ee;
            }
            .accent-bar {
                width: 80px;
                height: 6px;
                background: #d98b62;
                margin: 32px auto 0;
                border-radius: 3px;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="wordmark">
                ACE<span class="realname">Rodney Boachie</span>
            </div>
            <h1>I build systems that don't stress under stress.</h1>
            <div class="accent-bar"></div>
        </div>
    </body>
</html>
```

- [ ] **Step 2: Render it to `og-image.png` at exactly 1200×630**

```bash
node -e "
const { chromium } = require('playwright');
const path = require('path');
const fileUrl = 'file://' + path.resolve('/Users/acerbk/AceProjs/general-mbappe-space/ace-personal-site/og-image.html');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
  await page.goto(fileUrl);
  await page.screenshot({ path: '/Users/acerbk/AceProjs/general-mbappe-space/ace-personal-site/og-image.png' });
  await browser.close();
})();
"
```

- [ ] **Step 3: Verify the output dimensions and visually inspect it**

```bash
sips -g pixelWidth -g pixelHeight /Users/acerbk/AceProjs/general-mbappe-space/ace-personal-site/og-image.png
```

Expected: `pixelWidth: 1200` and `pixelHeight: 630`.

Then view `og-image.png` directly (e.g. via the Read tool or an image viewer) and confirm it shows the ACE wordmark, "Rodney Boachie", the headline, and the copper accent bar on a dark background, legible and not cropped.

- [ ] **Step 4: Commit**

```bash
git add og-image.html og-image.png
git commit -m "Add generated social preview image"
```

---

## Task 4: Add `robots.txt` and `sitemap.xml`

**Files:**
- Create: `robots.txt`
- Create: `sitemap.xml`

**Interfaces:**
- Produces: none — standalone crawl-config files with no dependency on other tasks.

- [ ] **Step 1: Create `robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://rodneyboachie.tech/sitemap.xml
```

- [ ] **Step 2: Create `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://rodneyboachie.tech/</loc>
        <lastmod>2026-07-12</lastmod>
        <changefreq>monthly</changefreq>
        <priority>1.0</priority>
    </url>
</urlset>
```

- [ ] **Step 3: Validate both files**

```bash
grep -q "^Sitemap: https://rodneyboachie.tech/sitemap.xml$" /Users/acerbk/AceProjs/general-mbappe-space/ace-personal-site/robots.txt && echo "robots.txt OK"
python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('/Users/acerbk/AceProjs/general-mbappe-space/ace-personal-site/sitemap.xml'); print('sitemap.xml OK: well-formed XML')"
```

Expected: `robots.txt OK` and `sitemap.xml OK: well-formed XML`.

- [ ] **Step 4: Commit**

```bash
git add robots.txt sitemap.xml
git commit -m "Add robots.txt and sitemap.xml"
```

---

## Task 5: Full regression pass

**Files:**
- Modify: `index.html` (only if Step 1 finds a regression to fix)

- [ ] **Step 1: Re-run the full existing QA pass across theme/viewport combinations**

```bash
node -e "
const { chromium } = require('playwright');
const path = require('path');
const fileUrl = 'file://' + path.resolve('/Users/acerbk/AceProjs/general-mbappe-space/ace-personal-site/index.html');
(async () => {
  const browser = await chromium.launch();

  async function check(label, opts) {
    const context = await browser.newContext(opts);
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(fileUrl);
    const scrollInfo = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    console.log(label, 'vScroll:', scrollInfo.scrollHeight > scrollInfo.clientHeight + 1, 'errors:', errors);
    await context.close();
  }

  await check('desktop-light', { viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  await check('desktop-dark', { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await check('mobile', { viewport: { width: 375, height: 667 }, colorScheme: 'light' });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(fileUrl);

  await page.click('#openModalBtn');
  console.log('modal opens:', await page.evaluate(() => document.getElementById('modalBackdrop').classList.contains('active')));
  await page.click('#closeModalBtn');
  console.log('modal closes:', !(await page.evaluate(() => document.getElementById('modalBackdrop').classList.contains('active'))));

  await page.click('button[data-theme-choice=\"dark\"]');
  console.log('theme toggle works:', await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark');

  const glowPresent = await page.evaluate(() => !!document.querySelector('.ambient-glow .glow-a') && !!document.querySelector('.ambient-glow .glow-b'));
  console.log('ambient glow present:', glowPresent);

  await ctx.close();
  await browser.close();
})();
"
```

Expected: `vScroll: false` and `errors: []` for all three viewport checks; `modal opens: true`; `modal closes: true`; `theme toggle works: true`; `ambient glow present: true`.

- [ ] **Step 2: Confirm no leftover issues**

```bash
grep -inE "server-rack|serverRoom|particle|led-strip|floor-grid|loadingScreen|Courier New" /Users/acerbk/AceProjs/general-mbappe-space/ace-personal-site/index.html
```

Expected: no output.

- [ ] **Step 3: Commit any fixes found in Step 1**

If Step 1 revealed a regression, fix it in `index.html` and commit:

```bash
git add index.html
git commit -m "Fix regression found in SEO regression pass"
```

If no regression was found, no commit is needed for this task.
