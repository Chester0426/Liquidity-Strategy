import { readFileSync } from "fs";
import path from "path";
import type { Page } from "@playwright/test";

const AUTH_FILE = path.join(__dirname, ".auth.json");

export function getTestCredentials() {
  return JSON.parse(readFileSync(AUTH_FILE, "utf-8")) as {
    email: string;
    password: string;
    userId: string;
  };
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
}

export async function blockAnalytics(page: Page) {
  await page.route("**/ingest/**", (route) => route.abort());
}

export async function checkNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  if (overflow) {
    throw new Error(
      `Horizontal overflow detected`
    );
  }
}
