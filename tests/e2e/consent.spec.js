import { test, expect } from "@playwright/test";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function collectBody(request) {
  if (!/\/api\/collect$/.test(new URL(request.url()).pathname) || request.method() !== "POST") return null;
  try { return JSON.parse(request.postData() || ""); } catch { return null; }
}

test("clicking Accept sends a consent hit with IDs for this page", async ({ page }) => {
  const pageview = page.waitForRequest((r) => collectBody(r)?.type === "pageview");
  await page.goto("/");
  const pv = collectBody(await pageview);
  expect(pv.consent).toBe(false);
  expect(pv.visitorId).toBeUndefined();

  const consent = page.waitForRequest((r) => collectBody(r)?.type === "consent");
  await page.locator('.ace-consent button[data-choice="accepted"]').click();
  const body = collectBody(await consent);
  expect(body).toEqual({
    type: "consent",
    pageId: pv.pageId,
    consent: true,
    visitorId: expect.stringMatching(UUID),
    sessionId: expect.stringMatching(UUID),
  });
});

test("clicking Decline sends no consent hit", async ({ page }) => {
  let sawConsent = false;
  page.on("request", (r) => { if (collectBody(r)?.type === "consent") sawConsent = true; });
  await page.goto("/");
  await page.locator('.ace-consent button[data-choice="declined"]').click();
  await page.waitForTimeout(300);
  expect(sawConsent).toBe(false);
});
