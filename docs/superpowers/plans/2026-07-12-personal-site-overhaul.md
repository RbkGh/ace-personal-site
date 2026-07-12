# Personal Site Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "3D server room" novelty `index.html` with a clean, single-screen, no-scroll personal site that signals professional mastery and drives visitors to a contact modal, per `docs/superpowers/specs/2026-07-12-personal-site-overhaul-design.md`.

**Architecture:** Single self-contained `index.html` — inline `<style>` and `<script>`, no build step, no external dependencies except the Formspree POST on form submit. Deploy is unchanged (push to `main`, gh-pages serves the file as-is).

**Tech Stack:** Plain HTML5, CSS (custom properties + `prefers-color-scheme` media query, `clamp()` for responsive type), vanilla JS (no frameworks), Formspree for form handling.

## Global Constraints

- No build step, no bundler, no webfonts — system font stack only (`-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif`).
- No scroll on desktop or mobile — content must fit one viewport at common sizes.
- Theme follows OS `prefers-color-scheme` only — no manual light/dark toggle.
- Accent color: muted copper `#c9754a` (light mode) / `#d98b62` (dark mode), used only for the CTA button, focus outlines, and hover states.
- Formspree endpoint is unchanged: `https://formspree.io/f/mnnblayg`.
- Contact form fields are exactly: Name, Email, Message (no "Reason" dropdown).
- Footer links: GitHub (`https://github.com/rbkgh`), LinkedIn (`https://linkedin.com/in/rodney-boachie`), Twitter (`https://twitter.com/ace_rbk`), Instagram (`https://instagram.com/ace_rbk`), PSN handle `ace_rbk`. No email/mailto link.
  - Note: the current site's PSN "link" (`href="ace_rbk"`) is not a valid URL. This plan renders PSN as plain (non-clickable) text with the handle instead of carrying the broken link forward — see Task 1.
- Headline: "I build systems that don't fall over."
- Philosophy line: "I care less about the stack than whether the logic holds — across backend, frontend, mobile, and infrastructure, that's the thread."
- Wordmark: "ACE" primary, "Rodney Boachie" secondary/smaller beneath it.
- CTA button label: "Let's talk →"

---

## Task 1: Base document, theme system, and static content

**Files:**
- Modify: `index.html` (full rewrite — removes all "3D server room" markup, CSS, and JS)

**Interfaces:**
- Produces: `#openModalBtn` (button element) — Task 2 attaches the click handler that opens the modal to this element's `id`.
- Produces: CSS custom properties `--bg`, `--fg`, `--muted`, `--accent`, `--accent-fg` — later tasks (modal, form) reuse these for consistent theming.

- [ ] **Step 1: Replace `index.html` with the base document, theme, and static layout**

Replace the entire contents of `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ace — Software Engineer</title>
<style>
  :root {
    --bg: #f7f6f3;
    --fg: #17161a;
    --muted: #6f6d72;
    --accent: #c9754a;
    --accent-fg: #17161a;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d0d0f;
      --fg: #f2f1ee;
      --muted: #918f95;
      --accent: #d98b62;
      --accent-fg: #0d0d0f;
    }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 24px;
  }
  .container { max-width: 640px; text-align: center; }
  .wordmark {
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .realname {
    display: block;
    font-weight: 400;
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 2px;
    letter-spacing: 0.02em;
    text-transform: none;
  }
  h1 {
    font-size: clamp(1.75rem, 5vw, 3rem);
    font-weight: 700;
    line-height: 1.15;
    margin: 28px 0 16px;
  }
  .philosophy {
    font-size: clamp(0.95rem, 2.2vw, 1.15rem);
    color: var(--muted);
    line-height: 1.5;
    max-width: 46ch;
    margin: 0 auto 32px;
  }
  .cta {
    display: inline-block;
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    padding: 14px 28px;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: transform 0.15s ease, opacity 0.15s ease;
    font-family: inherit;
  }
  .cta:hover { transform: translateY(-1px); opacity: 0.9; }
  .cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

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
  footer a, footer span {
    color: var(--muted);
    text-decoration: none;
  }
  footer a:hover { color: var(--fg); }

  @media (max-width: 480px) {
    h1 { margin: 20px 0 12px; }
    .philosophy { margin-bottom: 24px; }
    footer { gap: 12px; font-size: 0.72rem; bottom: 14px; }
  }
</style>
</head>
<body>
  <div class="container">
    <div class="wordmark">ACE<span class="realname">Rodney Boachie</span></div>
    <h1>I build systems that don't fall over.</h1>
    <p class="philosophy">I care less about the stack than whether the logic holds — across backend, frontend, mobile, and infrastructure, that's the thread.</p>
    <button class="cta" id="openModalBtn">Let's talk →</button>
  </div>

  <footer>
    <a href="https://github.com/rbkgh" target="_blank" rel="noopener">GitHub</a>
    <a href="https://linkedin.com/in/rodney-boachie" target="_blank" rel="noopener">LinkedIn</a>
    <a href="https://twitter.com/ace_rbk" target="_blank" rel="noopener">Twitter</a>
    <a href="https://instagram.com/ace_rbk" target="_blank" rel="noopener">Instagram</a>
    <span>PSN: ace_rbk</span>
  </footer>
</body>
</html>
```

- [ ] **Step 2: Verify the static layout in a browser**

Run: `open index.html`

Expected: Default browser opens showing a centered "ACE" wordmark with "Rodney Boachie" beneath it, the headline "I build systems that don't fall over.", the philosophy line, a copper "Let's talk →" button, and five footer items (GitHub, LinkedIn, Twitter, Instagram, PSN: ace_rbk) centered at the bottom. No scrollbar should appear at a normal desktop window size (~1440×900).

- [ ] **Step 3: Verify light/dark theme switching**

In Chrome DevTools: open DevTools → Cmd+Shift+P → run "Show Rendering" → find "Emulate CSS media feature prefers-color-scheme" → toggle between `light` and `dark`.

Expected: Background and text colors invert (off-white/near-black in light, near-black/off-white in dark) with no layout shift; the CTA button stays copper-toned in both.

- [ ] **Step 4: Verify mobile viewport**

In Chrome DevTools: toggle device toolbar (Cmd+Shift+M), select "iPhone SE" (375×667).

Expected: All content still fits without a vertical scrollbar; headline text is smaller (via `clamp()`) but not truncated; footer items stay on one line or wrap gracefully without overlapping.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Rebuild index.html as a minimal single-screen site"
```

---

## Task 2: Contact modal — structure and open/close interaction

**Files:**
- Modify: `index.html` (add modal markup, CSS, and open/close JS)

**Interfaces:**
- Consumes: `#openModalBtn` (button element, produced by Task 1).
- Produces: `#modalBackdrop` (modal container element), `#contactForm` (form element), `#formStatus` (status message element) — Task 3 attaches the submit handler to `#contactForm` and writes messages into `#formStatus`.

- [ ] **Step 1: Add modal CSS**

Add the following inside the existing `<style>` block, after the `footer` rules and before the `@media (max-width: 480px)` block:

```css
  .modal-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }
  .modal-backdrop.active { display: flex; }
  .modal {
    background: var(--bg);
    color: var(--fg);
    border-radius: 10px;
    padding: 28px;
    max-width: 420px;
    width: 100%;
    position: relative;
    border: 1px solid var(--muted);
  }
  .modal-close {
    position: absolute;
    top: 14px;
    right: 14px;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1.3rem;
    cursor: pointer;
    line-height: 1;
  }
  .modal-close:hover { color: var(--fg); }
  .modal h2 { font-size: 1.2rem; margin-bottom: 18px; }
  .form-group { margin-bottom: 14px; text-align: left; }
  .form-group label {
    display: block;
    font-size: 0.8rem;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--muted);
    border-radius: 6px;
    background: transparent;
    color: var(--fg);
    font-family: inherit;
    font-size: 0.95rem;
  }
  .form-group textarea { resize: vertical; min-height: 80px; }
  .form-group input:focus,
  .form-group textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .modal-submit {
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    width: 100%;
  }
  .modal-submit:hover { opacity: 0.9; }
  .form-status { margin-top: 12px; font-size: 0.85rem; min-height: 1.2em; }
  .form-status.success { color: #3a9d5d; }
  .form-status.error { color: #c94a4a; }
```

- [ ] **Step 2: Add modal HTML markup**

Add the following immediately before the closing `</body>` tag:

```html
  <div class="modal-backdrop" id="modalBackdrop">
    <div class="modal">
      <button class="modal-close" id="closeModalBtn" aria-label="Close">×</button>
      <h2>Let's talk</h2>
      <form id="contactForm">
        <div class="form-group">
          <label for="name">Name</label>
          <input type="text" id="name" name="name" required>
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required>
        </div>
        <div class="form-group">
          <label for="message">Message</label>
          <textarea id="message" name="message" required></textarea>
        </div>
        <button type="submit" class="modal-submit">Send</button>
      </form>
      <div class="form-status" id="formStatus"></div>
    </div>
  </div>
```

- [ ] **Step 3: Add open/close JS**

Add the following immediately before the closing `</body>` tag (after the modal markup added in Step 2):

```html
  <script>
    (function () {
      const openBtn = document.getElementById('openModalBtn');
      const closeBtn = document.getElementById('closeModalBtn');
      const backdrop = document.getElementById('modalBackdrop');

      function openModal() {
        backdrop.classList.add('active');
      }
      function closeModal() {
        backdrop.classList.remove('active');
      }

      openBtn.addEventListener('click', openModal);
      closeBtn.addEventListener('click', closeModal);
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) closeModal();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModal();
      });
    })();
  </script>
```

- [ ] **Step 4: Verify modal open/close behavior**

Run: `open index.html`

Expected:
- Clicking "Let's talk →" opens a centered modal with Name/Email/Message fields and a dimmed backdrop.
- Clicking the × button closes it.
- Reopening, then clicking outside the modal (on the dimmed backdrop) closes it.
- Reopening, then pressing Escape closes it.
- No vertical scrollbar appears at desktop width; on mobile width (375×667, via DevTools device toolbar) the modal still fits within the viewport.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Add contact modal with open/close interaction"
```

---

## Task 3: Contact form submission via Formspree

**Files:**
- Modify: `index.html` (add form submit handler)

**Interfaces:**
- Consumes: `#contactForm` (form element), `#formStatus` (status element) — both produced by Task 2.

- [ ] **Step 1: Add the submit handler**

Inside the `<script>` block added in Task 2, add the following just before the closing `})();` line:

```javascript
      const form = document.getElementById('contactForm');
      const status = document.getElementById('formStatus');

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        status.textContent = 'Sending...';
        status.className = 'form-status';

        fetch('https://formspree.io/f/mnnblayg', {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' }
        })
          .then(function (response) {
            if (response.ok) {
              status.textContent = "Message sent — thanks, I'll be in touch.";
              status.className = 'form-status success';
              form.reset();
            } else {
              return response.json().then(function (data) {
                const msg = data && data.errors
                  ? data.errors.map(function (err) { return err.message; }).join(', ')
                  : 'Something went wrong. Please try again.';
                status.textContent = msg;
                status.className = 'form-status error';
              });
            }
          })
          .catch(function () {
            status.textContent = 'Network error. Please check your connection.';
            status.className = 'form-status error';
          });
      });
```

- [ ] **Step 2: Verify the success path with a real submission**

Run: `open index.html`

In the browser: click "Let's talk →", fill in Name/Email/Message with test values, click "Send".

Expected: Status text changes to "Sending..." then to "Message sent — thanks, I'll be in touch." in green, and the form fields clear. This is a real POST to the existing Formspree endpoint (`mnnblayg`), so a real test submission will be recorded there — that's expected and fine.

- [ ] **Step 3: Verify the error path**

Temporarily edit the fetch URL in `index.html` from `https://formspree.io/f/mnnblayg` to `https://formspree.io/f/invalid-test-id`, save, then repeat Step 2's submission in the browser.

Expected: Status text shows an error message in red (either the Formspree-returned error text, or "Something went wrong. Please try again.").

Then revert the URL back to `https://formspree.io/f/mnnblayg` and save.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Wire contact form submission to Formspree"
```

---

## Task 4: Final cleanup and cross-checks

**Files:**
- Modify: `index.html` (cleanup only, if needed)

- [ ] **Step 1: Confirm no leftover code from the old design**

Run: `grep -inE "server-rack|serverRoom|particle|led-strip|floor-grid|loadingScreen|Courier New" index.html`

Expected: No output (empty match) — confirms none of the old "3D server room" CSS classes, IDs, or fonts remain. If anything matches, remove it from `index.html`.

- [ ] **Step 2: Full manual QA pass**

Run: `open index.html`

Walk through this checklist directly in the browser:
- [ ] Desktop width (~1440×900): no scrollbar, all content visible.
- [ ] Mobile width (375×667 via DevTools device toolbar): no scrollbar, no overlapping text, footer items readable.
- [ ] Light mode (DevTools → Rendering → `prefers-color-scheme: light`): correct off-white/near-black palette.
- [ ] Dark mode (same panel → `dark`): correct near-black/off-white palette, copper accent still visible on the CTA button.
- [ ] Click each footer link (GitHub, LinkedIn, Twitter, Instagram) in a new tab and confirm each opens the correct profile URL listed in Global Constraints above. "PSN: ace_rbk" is plain text, not a link — confirm it is not clickable.
- [ ] Open the modal, close it via ×, via click-outside, and via Escape — confirm all three work.
- [ ] Submit the form with valid data — confirm the success message appears and the form clears.

- [ ] **Step 3: Commit any final fixes**

If Step 1 or Step 2 required changes:

```bash
git add index.html
git commit -m "Clean up remaining issues from site overhaul QA pass"
```

If no changes were needed, no commit is required for this task.
