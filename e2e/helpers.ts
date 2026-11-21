import { expect, type Page } from "@playwright/test";

export const webUrl = process.env.E2E_WEB_URL ?? "http://localhost:3000";

export function adminCredentials() {
  const username = process.env.E2E_ADMIN_USERNAME ?? process.env.INITIAL_ADMIN_USERNAME;
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password) throw new Error("Cần E2E_ADMIN_USERNAME/E2E_ADMIN_PASSWORD hoặc INITIAL_ADMIN_* trong .env.");
  return { username, password };
}

export async function loginAsAdmin(page: Page) {
  const { username, password } = adminCredentials();
  await page.goto("/admin/login");
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin(\/)?$/);
}
