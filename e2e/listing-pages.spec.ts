import { expect, test } from "@playwright/test";

import { loginAsAdmin, webUrl } from "./helpers";

test.describe("Trang danh sách là Trang website", () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  test("Cài đặt không còn mục tiêu đề trang; module có lối tắt tới trang danh sách", async ({ page }) => {
    const navigation = page.getByRole("navigation", { name: "Điều hướng quản trị" });
    await expect(navigation.getByRole("link", { name: /Tiêu đề trang/ })).toHaveCount(0);

    await page.goto("/admin/tin-tuc");
    const shortcut = page.getByRole("complementary", { name: "Trang danh sách trên website" });
    await expect(shortcut).toContainText("/tin-tuc");
    await shortcut.getByRole("link", { name: "Sửa phần đầu trang & SEO" }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Trang danh sách", { exact: true }).first()).toBeVisible();
  });

  test("Sửa tiêu đề trang danh sách trong CMS hiện trên website rồi khôi phục", async ({ page, request }) => {
    // Có PUBLISH_WEB_REVALIDATE_* thì website đổi gần như ngay; thiếu (thường ở local) thì chờ TTL 60 giây
    // của Data Cache, lượt đầu sau hạn còn trả bản cũ (stale-while-revalidate) nên cho tới ~2 phút.
    test.setTimeout(180_000);
    await page.goto("/admin/tin-tuc");
    await page.getByRole("complementary", { name: "Trang danh sách trên website" }).getByRole("link", { name: "Sửa phần đầu trang & SEO" }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);

    const heroTitle = page.getByLabel("Tiêu đề", { exact: true }).first();
    const original = await heroTitle.inputValue();
    const changed = `${original} (kiểm thử ${Date.now()})`;
    const save = page.getByRole("button", { name: "Lưu thay đổi" });

    try {
      await heroTitle.fill(changed);
      await save.click();
      await expect(page.getByRole("status").filter({ hasText: "Đã lưu thay đổi" }).first()).toBeVisible();
      await expect.poll(async () => (await request.get(`${webUrl}/tin-tuc`)).text(), { timeout: 130_000, intervals: [1_000, 3_000, 5_000] }).toContain(changed);
    } finally {
      await page.reload();
      const current = page.getByLabel("Tiêu đề", { exact: true }).first();
      if (await current.inputValue() !== original) {
        await current.fill(original);
        await page.getByRole("button", { name: "Lưu thay đổi" }).click();
        await expect(page.getByRole("status").filter({ hasText: "Đã lưu thay đổi" }).first()).toBeVisible();
      }
    }
  });

  test("Id không tồn tại hiện trang 404 của CMS, không phải lỗi Backend", async ({ page }) => {
    await page.goto("/admin/tin-tuc/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: /không tồn tại hoặc đã bị xóa/ })).toBeVisible();
  });

  test("Hỗ trợ cài đặt có tab Hướng dẫn và website có hai phần neo", async ({ page, request }) => {
    await page.goto("/admin/tai-nguyen?tab=guides");
    await expect(page.getByRole("navigation", { name: "Nội dung hỗ trợ cài đặt" }).getByRole("link", { name: "Hướng dẫn" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Hỗ trợ cài đặt" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();

    const html = await (await request.get(`${webUrl}/ho-tro/cai-dat`)).text();
    expect(html).toContain('id="tep-cai-dat"');
    expect(html).toContain('id="huong-dan"');
  });
});
