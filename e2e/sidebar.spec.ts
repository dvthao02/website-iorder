import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

// Thu gọn sidebar trên desktop: khung còn cột 60px, nhóm thành nút biểu tượng mở được danh sách con.
test("Thu gọn và mở lại thanh điều hướng trên desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await loginAsAdmin(page);
  await page.goto("/admin/tin-tuc");
  const shell = page.locator(".admin-shell");
  const sidebar = page.locator(".admin-sidebar");

  await page.getByRole("button", { name: "Thu gọn thanh điều hướng" }).click();
  await expect(shell).toHaveClass(/(^|\s)admin-shell--collapsed(\s|$)/);
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(60);
  await expect(page.getByRole("link", { name: "Bài viết & Tin tức" })).toBeHidden();

  await page.getByRole("button", { name: "Mở nhóm Nội dung" }).click();
  await expect(page.getByRole("link", { name: "Bài viết & Tin tức" })).toBeVisible();

  await page.getByRole("button", { name: "Mở rộng thanh điều hướng" }).click();
  await expect(shell).not.toHaveClass(/admin-shell--collapsed/);
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(232);
});
