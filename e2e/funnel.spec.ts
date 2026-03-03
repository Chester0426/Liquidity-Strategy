import { test, expect } from "@playwright/test";
import { getTestCredentials, login, blockAnalytics } from "./helpers";

test.describe.serial("User funnel", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
  });

  test("landing page shows pitch and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /launch tokens backed by real liquidity/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /launch your st token/i }).first()
    ).toBeVisible();
  });

  test("CTA navigates to create page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /launch your st token/i }).first().click();
    await expect(page).toHaveURL(/\/create/);
    await expect(page.getByRole("heading", { name: /create st token/i })).toBeVisible();
  });

  test("create page has search form", async ({ page }) => {
    await page.goto("/create");
    await expect(page.getByPlaceholder(/token symbol or address/i)).toBeVisible();
  });

  test("login and reach explore", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await expect(page).toHaveURL(/\/explore/);
  });

  test("explore page shows token list or empty state", async ({ page }) => {
    const { email, password } = getTestCredentials();
    await login(page, email, password);
    await page.goto("/explore");
    // Either shows a grid of tokens or the empty state
    const hasGrid = await page.getByRole("link").count() > 0;
    const hasEmpty = await page.getByText(/no st tokens yet/i).isVisible().catch(() => false);
    expect(hasGrid || hasEmpty).toBeTruthy();
  });

  test("revenue page shows stats", async ({ page }) => {
    await page.goto("/revenue");
    await expect(page.getByRole("heading", { name: /platform revenue/i })).toBeVisible();
  });
});
