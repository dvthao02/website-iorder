import { expect, test } from "@playwright/test";

import { loginAsAdmin, webUrl } from "./helpers";

test.describe("CMS", () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  test("Đăng nhập và thấy menu quản trị", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Vai trò & quyền" }).first()).toBeAttached();
    await expect(page.getByRole("link", { name: "Bài viết & Tin tức" }).first()).toBeAttached();
  });

  test("Ma trận quyền: tích quyền kéo theo Xem, nhóm hiện indeterminate, bỏ thay đổi không lưu", async ({ page }) => {
    await page.goto("/admin/phan-quyen");
    await expect(page.getByRole("heading", { name: "Vai trò & quyền" })).toBeVisible();
    await page.getByRole("button", { name: "Tạo vai trò" }).click();

    const publish = page.getByRole("checkbox", { name: "Xuất bản — Bài viết & hướng dẫn" });
    const view = page.getByRole("checkbox", { name: "Xem — Bài viết & hướng dẫn" });
    const moduleBox = page.getByRole("checkbox", { name: "Chọn tất cả quyền của Bài viết & hướng dẫn" });
    await publish.check();
    await expect(view).toBeChecked();
    expect(await moduleBox.evaluate((input: HTMLInputElement) => input.indeterminate)).toBe(true);

    await moduleBox.check();
    await expect(page.getByRole("checkbox", { name: "Xóa — Bài viết & hướng dẫn" })).toBeChecked();
    expect(await moduleBox.evaluate((input: HTMLInputElement) => input.indeterminate)).toBe(false);

    await view.uncheck();
    await expect(publish).not.toBeChecked();

    await page.getByRole("checkbox", { name: "Chọn tất cả quyền", exact: true }).check();
    await expect(page.getByRole("checkbox", { name: "Xem — Nhật ký" })).toBeChecked();
    // Module không có hành động "Xóa" thì không có ô tương ứng.
    await expect(page.getByRole("checkbox", { name: "Xóa — Menu" })).toHaveCount(0);
  });

  test("Super Admin chỉ xem, không sửa được", async ({ page }) => {
    await page.goto("/admin/phan-quyen");
    await page.getByRole("button", { name: /Super Admin/ }).first().click();
    await expect(page.getByText("Super Admin luôn có toàn quyền")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Xóa — Vai trò" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Xóa — Vai trò" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Lưu vai trò" })).toHaveCount(0);
  });

  test("Chuyển hướng: tạo, Escape chỉ đóng hộp xác nhận, rồi xóa qua hộp xác nhận", async ({ page, baseURL }) => {
    const source = `/e2e-${Date.now()}`;
    // Remove the redirect even when an assertion fails midway.
    try {
    await page.goto("/admin/chuyen-huong");
    await page.getByRole("button", { name: "Tạo chuyển hướng" }).click();
    await page.getByRole("textbox", { name: "Đường dẫn cũ" }).fill(source);
    await page.getByRole("textbox", { name: "Đường dẫn mới" }).fill("/");
    await page.locator('button[form="redirect-editor"]').click();
    await expect(page.getByRole("button", { name: "Xóa", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Hủy" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    // Panel bên dưới vẫn mở: Escape không bị panel bắt mất.
    await expect(page.getByRole("button", { name: "Xóa", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click();
    await expect(page.getByText(source)).toHaveCount(0);
    } finally {
      const list = await page.request.get("/api/admin/redirects");
      const leftover = list.ok() ? ((await list.json()).redirects as Array<{ id: string; sourcePath: string }>).find((item) => item.sourcePath === source) : undefined;
      if (leftover) await page.request.delete(`/api/admin/redirects?id=${leftover.id}`, { headers: { origin: baseURL! } });
    }
  });

  test("Website public hiển thị trang chủ và tin tức", async ({ page }) => {
    const home = await page.goto(webUrl);
    expect(home?.status()).toBe(200);
    const news = await page.goto(`${webUrl}/tin-tuc`);
    expect(news?.status()).toBe(200);
    // Only assert article links when the database actually has published posts.
    const links = page.locator("a[href^='/tin-tuc/']");
    if (await links.count()) await expect(links.first()).toBeVisible();
  });
});
