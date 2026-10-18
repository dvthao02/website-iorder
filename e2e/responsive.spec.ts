import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

// Chạy ở project "mobile": trang không được cuộn ngang, ma trận quyền cuộn trong khung riêng.
test("Trang Vai trò dùng được trên mobile", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/phan-quyen");
  await page.getByRole("button", { name: "Tạo vai trò" }).click();
  await expect(page.getByRole("checkbox", { name: "Xem — Bài viết & hướng dẫn" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
