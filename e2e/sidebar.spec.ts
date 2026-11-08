import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

// Thu gọn sidebar trên desktop: khung còn cột 60px, nhóm thành nút biểu tượng mở được danh sách con.
test("Thu gọn và mở lại thanh điều hướng trên desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await loginAsAdmin(page);
  await page.goto("/admin/news");
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

// Nhóm Nội dung gọn: Sản phẩm/Giải pháp/Dịch vụ chung một màn có tab; Chuyên mục & Thẻ là màn con của Bài viết.
test("Sản phẩm & Dịch vụ một màn có tab loại; Chuyên mục & Thẻ thuộc Bài viết", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await loginAsAdmin(page);
  const sidebar = page.locator(".admin-sidebar");
  await expect(sidebar.getByRole("link", { name: "Chuyên mục & Thẻ" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Giải pháp", exact: true })).toHaveCount(0);

  // Đường dẫn cũ chuyển về màn gộp, đúng tab.
  await page.goto("/admin/solutions");
  await expect(page).toHaveURL(/\/admin\/products\?type=solution$/);
  await expect(page.getByRole("tab", { name: "Giải pháp" })).toHaveAttribute("aria-selected", "true");
  await expect(sidebar.getByRole("link", { name: "Sản phẩm & Dịch vụ" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Tạo giải pháp" })).toHaveAttribute("href", "/admin/solutions/new");

  await page.getByRole("tab", { name: "Tất cả" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByText("Loại", { exact: true })).toBeVisible();
  await page.getByLabel("Chọn loại cần tạo").click();
  for (const [label, href] of [["Sản phẩm", "/admin/products/new"], ["Giải pháp", "/admin/solutions/new"], ["Dịch vụ", "/admin/services/new"]]) {
    await expect(page.locator(".admin-header-popover--menu").getByRole("link", { name: new RegExp(`^${label}`) })).toHaveAttribute("href", href);
  }

  await page.goto("/admin/news");
  await page.getByRole("link", { name: "Chuyên mục & Thẻ" }).click();
  await expect(page).toHaveURL(/\/admin\/taxonomy$/);
  await expect(sidebar.getByRole("link", { name: "Bài viết & Tin tức" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Vị trí hiện tại" })).toContainText("Chuyên mục & Thẻ");
});

// Nhóm Nội dung: Trang chủ (mục riêng) → Bài viết & Tin tức → Trang tĩnh (bảng trang tự tạo + danh mục trang có sẵn).
test("Trang chủ trên sidebar, Trang tĩnh, Sửa nội dung từ Menu", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await loginAsAdmin(page);
  const sidebar = page.locator(".admin-sidebar");
  await expect(sidebar.getByRole("link", { name: "Trang website" })).toHaveCount(0);

  await sidebar.getByRole("link", { name: "Trang chủ" }).click();
  await expect(page).toHaveURL(/\/admin\/homepage$/);
  // Trang hệ thống: tên cố định nằm ở thanh tiêu đề (không có ô "Tên trang" để sửa).
  await expect(page.locator(".admin-detail-panel__header")).toContainText("Trang chủ");
  await expect(page.getByLabel("Tên trang")).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("aria-current", "page");

  const content = sidebar.locator(".admin-navigation__group").filter({ has: page.locator(".admin-navigation__group-toggle", { hasText: "Nội dung" }) });
  await expect(content.getByRole("link").nth(0)).toHaveText("Trang chủ");
  await expect(content.getByRole("link").nth(1)).toHaveText("Bài viết & Tin tức");
  await expect(content.getByRole("link").nth(2)).toHaveText("Trang tĩnh");
  await sidebar.getByRole("link", { name: "Trang tĩnh" }).click();
  await expect(page).toHaveURL(/\/admin\/pages$/);
  // Một bảng gồm mọi trang trừ Trang chủ (có mục riêng), tab lọc theo loại; trang danh sách ghi rõ lấy từ module nào.
  const table = page.locator(".admin-data-table");
  await expect(table.getByRole("link", { name: /^Chính sách bảo mật/ })).toBeVisible();
  await expect(table.getByRole("link", { name: "Bài viết & Tin tức" })).toBeVisible();
  await expect(table.getByText("/", { exact: true })).toHaveCount(0);
  const tabs = page.getByRole("tablist", { name: "Loại trang" });
  await tabs.getByRole("tab", { name: /^Trang danh sách/ }).click();
  await expect(page).toHaveURL(/type=listing/);
  await expect(table.getByText("/tin-tuc", { exact: true })).toBeVisible();
  await expect(table.getByText("/chinh-sach-bao-mat")).toHaveCount(0);
  // Chọn nhiều dòng vẫn dùng được (xuất bản / chuyển về nháp); trang có sẵn không lưu trữ được nên "Lưu trữ" mờ kèm lý do.
  await table.locator("tbody input[type=checkbox]").first().check();
  await page.locator("summary[aria-label=\"Chọn thao tác cho các dòng đã chọn\"]").click();
  const archive = page.getByRole("menuitem", { name: /^Lưu trữ/ });
  await expect(archive).toBeDisabled();
  await expect(archive).toHaveAttribute("title", /không lưu trữ hay xóa được/);
  await expect(page.getByRole("menuitem", { name: /^Chuyển về nháp/ })).toBeEnabled();
  await page.keyboard.press("Escape");

  await page.goto("/admin/menu");
  const row = page.locator(".admin-sortable-row").filter({ hasText: "Về chúng tôi" });
  test.skip(await row.count() === 0, "Menu chưa có mục Về chúng tôi");
  await row.first().click();
  const edit = page.getByRole("link", { name: "Sửa nội dung" });
  await expect(edit).toHaveAttribute("href", /\/admin\/pages\/[0-9a-f-]{36}$/);
});
