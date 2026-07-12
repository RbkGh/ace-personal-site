# SEO Optimization — Design

## Goal

Make `index.html` discoverable and correctly represented in search results and social link previews, without changing the site's minimal content or design established in the earlier overhaul (`docs/superpowers/specs/2026-07-12-personal-site-overhaul-design.md`) and ambient glow (`docs/superpowers/specs/2026-07-12-ambient-background-glow-design.md`) specs.

## Scope

Technical/structural SEO only:
- Meta tags, canonical URL, Open Graph, Twitter Card
- JSON-LD structured data
- Favicon
- `robots.txt` and `sitemap.xml`
- One semantic HTML landmark tweak (`<main>`)

No copy rewrites to the visible page content (headline/philosophy stay as-is — the minimal, non-resume-y tone is intentional). No domain/DNS/hosting configuration changes — canonical/OG URLs reference `https://rodneyboachie.tech/` as the production domain, but deployment settings are untouched.

## Meta Tags & Canonical

Add to `<head>`, alongside the existing `<title>`:

- `<title>Ace (Rodney Boachie) — Experienced Software Engineer</title>` (replaces current `Ace — Software Engineer`)
- `<meta name="description" content="Rodney Boachie (Ace) — experienced software engineer with 10+ years across backend, frontend, mobile, and DevOps. I build systems that don't stress under stress.">`
- `<meta name="author" content="Rodney Boachie">`
- `<link rel="canonical" href="https://rodneyboachie.tech/">`
- `<meta name="theme-color" content="#c9754a">`

## Open Graph & Twitter Card

- `og:type` = `website`
- `og:url` = `https://rodneyboachie.tech/`
- `og:title` = `Ace (Rodney Boachie) — Experienced Software Engineer`
- `og:description` = same text as the meta description above
- `og:site_name` = `Ace`
- `og:image` = `https://rodneyboachie.tech/og-image.png` (1200×630)
- `og:image:width` = `1200`, `og:image:height` = `630`
- `twitter:card` = `summary_large_image`
- `twitter:title`, `twitter:description`, `twitter:image` mirror the Open Graph values above

## Social Preview Image

A standalone `og-image.html` (not linked from the live site, used only to render the asset) — dark-theme card at exactly 1200×630px, showing the `ACE` wordmark, the headline, and the copper accent, visually consistent with the live site's dark theme. Rendered to `og-image.png` via headless Chromium (Playwright), the same method already used to verify this site's visual behavior — no new tooling, no external image-generation service, no build step added to the live page.

## JSON-LD Structured Data

A `<script type="application/ld+json">` block in `<head>` with a `Person` schema:

```json
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
```

## Favicon

Inline SVG data-URI via `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">` — a rounded-square dark background with an "A" monogram in the copper accent color. No extra file, no build step, consistent with the rest of the site's self-contained approach.

## Crawlability Files

Two new files at the repo root (sibling to `index.html`):

- `robots.txt` — allows all crawlers, references the sitemap:
  ```
  User-agent: *
  Allow: /

  Sitemap: https://rodneyboachie.tech/sitemap.xml
  ```
- `sitemap.xml` — single-URL sitemap listing the root page with a `lastmod` date.

## Semantic HTML Tweak

Replace the existing `<div class="container">` wrapper around the main page content with `<main class="container">` — improves landmark structure for crawlers and assistive technology. No visual or behavioral change; `.container`'s existing CSS rule applies identically to a `<main>` element.

## Out of Scope

- No changes to visible page copy beyond the title/meta-description text specified above (which isn't visible on the page itself).
- No DNS, hosting, or deployment configuration changes.
- No multi-page sitemap, no blog/content additions.
- No image formats beyond the one generated PNG (no `.ico` favicon fallback — modern browsers support SVG favicons; this matches the site's minimal-file-count approach).

## Testing / Verification Plan

Same headless-browser approach used throughout this project (no build step, no test framework):

- Load `index.html` and confirm via DOM inspection that all new `<meta>`, `<link>`, and `<script type="application/ld+json">` tags are present with the exact values specified above.
- Parse the JSON-LD block and confirm it's valid JSON matching the schema above.
- Confirm `favicon` link resolves (no 404/parse error) by checking the browser's console for icon-load errors.
- Render `og-image.html` and confirm the output PNG is exactly 1200×630px.
- Confirm `robots.txt` and `sitemap.xml` are valid (plain-text/XML respectively) and reference the correct sitemap URL.
- Re-run the existing full QA pass (no scroll, modal, form, theme toggle, ambient glow) to confirm none of these additions regressed prior behavior.
