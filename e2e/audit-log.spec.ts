import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test("Nhật ký ghi đăng nhập/đăng xuất kèm IP, thiết bị và mã request", async ({ page }) => {
  await loginAsAdmin(page);
  await page.locator('summary[aria-label="Mở menu tài khoản"]').click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await loginAsAdmin(page);

  await page.goto("/admin/nhat-ky?query=" + encodeURIComponent("Đăng xuất"));
  const table = page.locator("table");
  await expect(table.locator("thead th").filter({ hasText: /^IP/ })).toBeVisible();
  await expect(table.locator("thead th").filter({ hasText: /^Thiết bị/ })).toBeVisible();
  const row = table.locator("tbody tr").first();
  await expect(row).toContainText("Đăng xuất");
  await expect(row).toContainText(/Chrome|Firefox|Safari|Edge/);

  await row.click();
  const panel = page.getByRole("dialog", { name: "Chi tiết thao tác" });
  await expect(panel).toContainText("Địa chỉ IP");
  await expect(panel).toContainText("Mã request");
  await expect(panel.locator("code").last()).toHaveText(/^[0-9a-f-]{36}$/);
});
