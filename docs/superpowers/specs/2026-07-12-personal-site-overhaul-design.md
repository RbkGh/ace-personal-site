# Personal Site Overhaul — Design

## Goal

Replace the current "3D server room" novelty page with a clean, minimal, single-screen site that signals professional mastery and prompts visitors to reach out — without listing a full resume. Confidence over completeness; intrigue over exhaustiveness.

## Current State

`index.html` is a single self-contained file (inline CSS/JS, no build step), deployed via gh-pages on push to `main`. It renders a draggable 3D scene with three clickable "server racks" (About / Network / Contact), Courier New monospace, cyan-on-black, particle effects, and a Formspree-backed contact form (endpoint `mnnblayg`). All of this is being replaced; none of the visual/interaction logic carries over.

## Architecture

- Single self-contained `index.html` — inline `<style>` and `<script>`, no external dependencies except the Formspree POST on submit.
- No build step. Deploy is unchanged: push to `main`, gh-pages serves the file.
- No JS frameworks, no bundler, no webfonts (system font stack only) — keeps load instant and the file trivially inspectable/editable.

## Layout

One viewport-height screen, centered content column, **no scroll** on desktop or mobile:

1. Wordmark: `ACE` (bold, small), with `Rodney Boachie` directly beneath it, smaller and muted
2. Headline (large, outcome-focused): *"I build systems that don't fall over."*
3. Philosophy line (one sentence, not a resume): *"I care less about the stack than whether the logic holds — across backend, frontend, mobile, and infrastructure, that's the thread."*
4. CTA button: `Let's talk →` — opens the contact modal
5. Footer row (small, muted, bottom of screen): `GitHub` · `LinkedIn` · `Twitter` · `Instagram` · `PSN` links

Exact copy is a first draft and may be tweaked after seeing it rendered, without changing the structure above.

## Visual System

- **Theme:** Defaults to `prefers-color-scheme`, overridable via a manual toggle. Dark mode: near-black background, off-white text. Light mode: off-white background, near-black text. Same layout, inverted palette. A three-way segmented control (`Light` / `Dark` / `Auto`) sits in the top-right corner; the chosen preference persists via `localStorage` and is applied before first paint to avoid a flash of the wrong theme. `Auto` (the default) tracks the OS setting live.
- **Typography:** System font stack (`-apple-system, "Inter", "Segoe UI", sans-serif`). Headline large and bold (weight 700), everything else restrained (weight 400). Headline scales via `clamp()` for responsive sizing.
- **Accent color:** One muted copper/amber accent (~`#c9754a`), used sparingly — CTA button and hover states only. Replaces the old cyan; deliberately distinct from typical tech-blue.

## Interaction

- CTA (`Let's talk →`) opens a centered modal: dimmed backdrop, closable via × button or click-outside.
- Modal form fields: **Name, Email, Message** (simplified from the current 4-field form — no "Reason" dropdown).
- Submits via POST to the existing Formspree endpoint (`https://formspree.io/f/mnnblayg`), unchanged from current integration.
- Success and error states shown inline within the modal (mirrors current behavior, restyled to match the new minimal aesthetic).

## Responsive Behavior

- Same single-screen, no-scroll layout on mobile as desktop.
- Headline font-size scales down via `clamp()` to avoid wrapping awkwardly or overflowing.
- Footer links wrap only if unavoidable; layout targets staying on one line at common mobile widths.
- No drag/3D/particle/HUD logic is ported over — fully removed.

## Out of Scope

- No email/mailto link in the footer (modal form is the only direct-contact path).
- No multi-page structure, no downloadable resume/CV link.
- No animations/effects beyond simple hover/transition states on the CTA, modal, and theme toggle.

## Testing / Verification Plan

Static HTML/CSS/JS, no build step — verified by opening the file directly in a browser:

- Visual check in both light and dark OS theme.
- Theme toggle: clicking Light/Dark/Auto updates the palette immediately, the correct option is visually marked active, and the choice persists across a page reload.
- Visual + interaction check at desktop and mobile viewport widths (confirm no scrollbars appear at common sizes).
- CTA opens modal; × and click-outside both close it.
- Form submit success path and error path both produce correct inline messaging.
- Footer links have correct `href` values (GitHub, LinkedIn, Twitter, Instagram, PSN — same targets as current site).
