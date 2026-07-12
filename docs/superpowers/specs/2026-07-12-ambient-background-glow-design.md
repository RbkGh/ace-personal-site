# Ambient Background Glow — Design

## Goal

Add a small creative, pleasant touch to the site's resting state without compromising the single-screen minimalism established in the overhaul (`docs/superpowers/specs/2026-07-12-personal-site-overhaul-design.md`). Purely atmospheric — no new content, no new interaction surface.

## What

A fixed, full-viewport background layer sitting behind all page content: two soft, blurred circles rendered in the existing `--accent` copper color, each slowly drifting along its own independent looped path so the motion never feels mechanical or repetitive.

## Implementation

- Two `div`s (e.g. `.ambient-glow` containing `.glow-a` and `.glow-b`), inserted as the first children of `<body>`.
- Each glow: a large circle (`border-radius: 50%`), `background: var(--accent)`, heavy `filter: blur(...)`, `opacity` in the 0.06–0.10 range.
- Motion via CSS `@keyframes` on `transform: translate(...)`, one keyframe set per glow, different duration/path so they desync visually. `animation-timing-function: ease-in-out`, `infinite`, alternating or looping smoothly (no jump-cut at loop boundary).
- Container: `position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;` — sits behind `.container`, `footer`, `.theme-toggle`, and the modal (all of which need `position: relative; z-index: 1` or higher if not already stacked above via existing `z-index` values).

## Interaction with Existing Elements

- `pointer-events: none` on the glow container — never intercepts clicks or text selection.
- Sits behind the modal backdrop too; barely perceptible there since the backdrop already dims the page.
- No JS involved — pure CSS, consistent with the site's existing no-build, inline-everything architecture.

## Theme Handling

Uses the existing `--accent` custom property, so it automatically follows whatever theme is active (light, dark, or manually toggled) with no additional theme-specific values needed.

## Accessibility

Respects `prefers-reduced-motion: reduce` — when set, the glow renders in a static (non-animated) position instead of looping.

## Out of Scope

- No change to layout, scroll behavior, load time, or any previously verified interaction (modal, form, theme toggle).
- No additional colors beyond the existing copper accent.
- No cursor-reactive behavior — motion is ambient/independent of mouse position.

## Testing / Verification Plan

Same approach as the rest of the site — headless-browser verification (Playwright), no build step:

- Visual check at desktop and mobile viewport widths, light and dark theme: glow is visible but clearly subtle, doesn't obscure text or the CTA.
- Confirm the glow container does not block clicks on the CTA, footer links, theme toggle, or modal (test that these remain fully clickable).
- Confirm no scrollbar is introduced (glow container must not expand document height/width).
- Confirm `prefers-reduced-motion: reduce` disables the animation (glow present but static).
- Confirm no console errors.
