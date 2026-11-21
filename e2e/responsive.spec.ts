import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

const cmsRoutes = [
  "/admin", "/admin/analytics", "/admin/pages", "/admin/news", "/admin/resources", "/admin/guides", "/admin/media",
  "/admin/products", "/admin/solutions", "/admin/services", "/admin/equipment", "/admin/equipment/groups",
  "/admin/menu", "/admin/taxonomy", "/admin/seo", "/admin/seo/publish-check", "/admin/redirects",
  "/admin/external-links", "/admin/company-profile", "/admin/partners", "/admin/leads",
  "/admin/users", "/admin/roles", "/admin/audit-log", "/admin/appearance",
  "/admin/homepage", "/admin/news/new", "/admin/guides/new", "/admin/pages/new", "/admin/products/new", "/admin/services/new", "/admin/equipment/new",
];

// Chạy ở project "mobile": trang không được cuộn ngang, ma trận quyền cuộn trong khung riêng.
test("Trang Vai trò dùng được trên mobile", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/roles");
  await page.getByRole("button", { name: "Tạo vai trò" }).click();
  await expect(page.getByRole("checkbox", { name: "Xem — Bài viết, tin tức & hướng dẫn" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("Panel chi tiết media phủ gọn màn hình điện thoại", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAdmin(page);
  await page.goto("/admin/media");

  const firstAsset = page.locator(".admin-media-grid > li > button").first();
  await expect(firstAsset).toBeVisible();
  await firstAsset.click();

  const panel = page.getByRole("dialog", { name: "Chi tiết tệp" });
  await expect(panel).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    panelWidth: document.querySelector(".admin-side-panel")?.getBoundingClientRect().width ?? 0,
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.panelWidth).toBe(dimensions.viewportWidth);
  expect(dimensions.documentWidth - dimensions.viewportWidth).toBeLessThanOrEqual(1);

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("Các trang CMS không tràn ngang trên điện thoại và máy tính bảng", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAsAdmin(page);

  const problems: string[] = [];
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const route of cmsRoutes) {
      await page.goto(route);
      await page.locator(".admin-shell__main").waitFor();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push(`${width}px ${route}: tràn ngang ${overflow}px`);
    }
  }

  expect(problems).toEqual([]);
});
