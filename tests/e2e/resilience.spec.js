import { test, expect } from "@playwright/test";

const FOOTER = {
  github: "https://github.com/rbkgh",
  linkedin: "https://linkedin.com/in/rodney-boachie",
  twitter: "https://twitter.com/ace_rbk",
  instagram: "https://instagram.com/ace_rbk",
};

async function load(page) {
  const errors = [];
  page.on("pageerror", (e) => {
    // The deliberately throwing analytics script is expected; anything else is a site bug.
    if (/\/analytics\//.test(`${e.message}\n${e.stack || ""}`)) return;
    errors.push(e);
  });
  return errors;
}

async function assertSiteWorks(page, errors) {
  await expect(page).toHaveTitle(/Ace \(Rodney Boachie\)/);

  await page.locator('#themeToggle button[data-theme-choice="dark"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.locator("#openModalBtn").click();
  await expect(page.locator("#modalBackdrop")).toHaveClass(/active/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#modalBackdrop")).not.toHaveClass(/active/);

  for (const [name, href] of Object.entries(FOOTER)) {
    await expect(page.locator(`a[data-analytics="${name}"]`)).toHaveAttribute("href", href);
  }
  expect(errors.map((e) => e.message)).toEqual([]);
}

test("analytics scripts blocked", async ({ page }) => {
  await page.route(/\/analytics\/|_vercel\/insights|googletagmanager/, (r) => r.abort());
  const errors = await load(page);
  await page.goto("/");
  await assertSiteWorks(page, errors);
  await expect(page.locator(".ace-consent")).toHaveCount(0);
  // Nothing fixed-position sits over the bottom of the viewport.
  const covered = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight - 5);
    return el && getComputedStyle(el).position === "fixed";
  });
  expect(covered).toBeFalsy();
});

test("api failing slowly", async ({ page }) => {
  const errors = await load(page);
  await page.goto("/");
  const start = Date.now();
  await dismissBanner(page);
  await assertSiteWorks(page, errors);
  expect(Date.now() - start).toBeLessThan(2000);
});

test("analytics scripts throw", async ({ page }) => {
  await page.route(/\/analytics\/tracker\.js/, (r) =>
    r.fulfill({ body: "throw new Error('boom')", contentType: "text/javascript" }),
  );
  const errors = await load(page);
  await page.goto("/");
  await dismissBanner(page);
  await assertSiteWorks(page, errors);
});

test("contact form succeeds with analytics blocked", async ({ page }) => {
  await page.route(/\/analytics\/|_vercel\/insights|googletagmanager/, (r) => r.abort());
  await page.route(/formspree\.io/, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await page.locator("#openModalBtn").click();
  await page.locator("#name").fill("Test User");
  await page.locator("#email").fill("test@example.com");
  await page.locator("#message").fill("Hello there");
  await page.locator('#contactForm [type="submit"]').click();
  await expect(page.locator("#formStatus")).toContainText("Message sent");
});

// If the consent banner is present, dismiss it so it cannot cover the page.
async function dismissBanner(page) {
  const btn = page.getByRole("button", { name: /decline|accept/i }).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
