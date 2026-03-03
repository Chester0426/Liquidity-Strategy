import { test, expect } from "@playwright/test";
import { blockAnalytics, checkNoHorizontalOverflow } from "./helpers";

test.describe.serial("Smoke tests — page loads", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
  });

  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  test("explore page loads", async ({ page }) => {
    await page.goto("/explore");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  test("create page loads", async ({ page }) => {
    await page.goto("/create");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  test("revenue page loads", async ({ page }) => {
    await page.goto("/revenue");
    await expect(page).toHaveTitle(/.+/);
    await checkNoHorizontalOverflow(page);
  });

  // Login/signup pages redirect to / — wallet auth replaces email auth.
  // Wallet connection requires a browser extension (Phantom/Solflare) and
  // cannot be automated in E2E tests.
});
