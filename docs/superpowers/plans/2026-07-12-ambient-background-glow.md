# Ambient Background Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small atmospheric touch to `index.html` — two soft, slowly drifting copper-accent glows behind the page content — per `docs/superpowers/specs/2026-07-12-ambient-background-glow-design.md`, without disturbing the site's existing minimalism, layout, or interactions.

**Architecture:** Pure CSS addition to the existing single-file `index.html` (no build step, no JS). Two `div`s inserted as the first children of `<body>`, animated via `@keyframes` on `transform`, using the existing `--accent` custom property so they follow the current theme automatically.

**Tech Stack:** Plain CSS (`@keyframes`, `filter: blur()`, `prefers-reduced-motion` media query). No new dependencies.

## Global Constraints

- Pure CSS/HTML only — no JavaScript, no new dependencies, no build step.
- Glow color is `var(--accent)` only — no additional colors.
- Glow opacity stays in the 0.06–0.10 range (per spec) — visible but clearly subtle.
- Must respect `prefers-reduced-motion: reduce` (animation disabled, glow stays static when set).
- Must not introduce a scrollbar, block clicks on any existing interactive element (CTA, footer links, theme toggle, modal), or affect load time.
- Must work correctly in light mode, dark mode, and both manual toggle overrides — automatically, since it only references `--accent`.

---

## Task 1: Add the ambient glow layer

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: `.ambient-glow` container div with two child divs `.glow-a` and `.glow-b`, inserted as the first children of `<body>`. No other task depends on this — it's a self-contained visual addition.

- [ ] **Step 1: Add the glow CSS**

In `index.html`, inside the existing `<style>` block, add the following immediately after the `:root[data-theme="dark"] { ... }` rule (i.e., right before the `* { margin: 0; ... }` reset rule):

```css
.ambient-glow {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
}
.glow {
    position: absolute;
    border-radius: 50%;
    background: var(--accent);
    filter: blur(120px);
    will-change: transform;
}
.glow-a {
    top: -15%;
    left: -15%;
    width: 60vmax;
    height: 60vmax;
    opacity: 0.09;
    animation: drift-a 34s ease-in-out infinite;
}
.glow-b {
    bottom: -20%;
    right: -15%;
    width: 50vmax;
    height: 50vmax;
    opacity: 0.06;
    animation: drift-b 42s ease-in-out infinite;
}
@keyframes drift-a {
    0%,
    100% {
        transform: translate(0, 0);
    }
    50% {
        transform: translate(10vmax, 8vmax);
    }
}
@keyframes drift-b {
    0%,
    100% {
        transform: translate(0, 0);
    }
    50% {
        transform: translate(-8vmax, -10vmax);
    }
}
@media (prefers-reduced-motion: reduce) {
    .glow-a,
    .glow-b {
        animation: none;
    }
}
```

- [ ] **Step 2: Raise existing content above the glow layer**

The glow container uses `z-index: 0`, so `.container` and `footer` need an explicit stacking position above it (the modal backdrop at `z-index: 1000` and `.theme-toggle` at `z-index: 10` are already above `0`, so they need no change).

In the existing `<style>` block, modify the `.container` rule from:

```css
.container {
    max-width: 640px;
    text-align: center;
}
```

to:

```css
.container {
    position: relative;
    z-index: 1;
    max-width: 640px;
    text-align: center;
}
```

And modify the `footer` rule from:

```css
footer {
    position: fixed;
    bottom: 20px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 18px;
    flex-wrap: wrap;
    font-size: 0.8rem;
}
```

to:

```css
footer {
    position: fixed;
    bottom: 20px;
    left: 0;
    right: 0;
    z-index: 1;
    display: flex;
    justify-content: center;
    gap: 18px;
    flex-wrap: wrap;
    font-size: 0.8rem;
}
```

- [ ] **Step 3: Add the glow markup**

In `index.html`, immediately after the `<body>` opening tag and before the existing `<div class="theme-toggle" id="themeToggle">` element, add:

```html
<div class="ambient-glow">
    <div class="glow glow-a"></div>
    <div class="glow glow-b"></div>
</div>
```

- [ ] **Step 4: Verify visually and functionally in a browser**

Use the project's existing Playwright-based verification approach (headless Chromium, screenshots + DOM checks — the same method used to verify the rest of this site, since there's no build step or test framework). From the repo root:

```bash
node -e "
const { chromium } = require('playwright');
const path = require('path');
const fileUrl = 'file://' + path.resolve('index.html');
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
    await page.screenshot({ path: 'shot-' + label + '.png' });
    await context.close();
  }

  await check('glow-desktop-light', { viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  await check('glow-desktop-dark', { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await check('glow-mobile', { viewport: { width: 375, height: 667 }, colorScheme: 'light' });

  // Reduced motion check
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(fileUrl);
  const animA = await page.evaluate(() => getComputedStyle(document.querySelector('.glow-a')).animationName);
  console.log('reduced-motion glow-a animationName:', animA, '(expect none)');
  await ctx.close();

  // Click-through check: CTA, footer link, theme toggle must still be clickable
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  await page2.goto(fileUrl);
  await page2.click('#openModalBtn');
  const modalActive = await page2.evaluate(() => document.getElementById('modalBackdrop').classList.contains('active'));
  console.log('CTA still opens modal through glow layer:', modalActive);
  await page2.click('#closeModalBtn');
  await page2.click('button[data-theme-choice=\"dark\"]');
  const themeActive = await page2.evaluate(() => document.documentElement.getAttribute('data-theme'));
  console.log('theme toggle still clickable through glow layer:', themeActive);
  await ctx2.close();

  await browser.close();
})();
"
```

Expected output:
- `vScroll: false` and `errors: []` for all three `check(...)` calls (desktop light, desktop dark, mobile).
- `reduced-motion glow-a animationName: none (expect none)`.
- `CTA still opens modal through glow layer: true`.
- `theme toggle still clickable through glow layer: dark`.

Then inspect the three screenshots (`shot-glow-desktop-light.png`, `shot-glow-desktop-dark.png`, `shot-glow-mobile.png`) directly: confirm the glow is visible as a soft, subtle color wash near the corners of the screen, doesn't obscure the headline/CTA/footer text, and looks appropriately faint (not a distracting blob) in both themes.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Add ambient background glow"
```
