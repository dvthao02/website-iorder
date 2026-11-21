import { expect, test } from "@playwright/test";

import { loginAsAdmin, webUrl } from "./helpers";

test.describe("Trang danh sách là Trang website", () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  test("Id không tồn tại hiện trang 404 của CMS, không phải lỗi Backend", async ({ page }) => {
    await page.goto("/admin/news/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: /không tồn tại hoặc đã bị xóa/ })).toBeVisible();
  });

  test("Hướng dẫn sử dụng tách khỏi Tệp cài đặt ở cả CMS và website", async ({ page, request }) => {
    await page.goto("/admin/resources?tab=guides");
    await expect(page).toHaveURL(/\/admin\/guides$/);
    await expect(page.getByRole("heading", { name: "Hướng dẫn sử dụng" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();

    const support = await (await request.get(`${webUrl}/ho-tro/cai-dat`)).text();
    expect(support).not.toContain('id="huong-dan"');
    const guides = await request.get(`${webUrl}/ho-tro/huong-dan`);
    expect(guides.status()).toBe(200);
    // Đường dẫn cũ /huong-dan (retiredPaths trong legacy-paths.ts) chuyển 301 về /ho-tro/huong-dan.
    const legacy = await request.get(`${webUrl}/huong-dan`, { maxRedirects: 0 });
    expect(legacy.headers().location).toContain("/ho-tro/huong-dan");
  });
});
