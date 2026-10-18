import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

// Tạo chuyên mục và thẻ ngay trong editor bài viết: mục mới hiện trong danh sách và được chọn sẵn,
// không cần sang màn "Chuyên mục & Thẻ". Dữ liệu kiểm thử được xóa sau khi chạy.
test("Tạo chuyên mục và thẻ ngay trong editor bài viết", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/tin-tuc/moi");
  const suffix = Date.now().toString(36);
  const categoryName = `Chuyên mục tại chỗ ${suffix}`;
  const tagName = `Thẻ tại chỗ ${suffix}`;
  const created: Array<{ kind: "categories" | "tags"; name: string }> = [];

  try {
    await page.getByRole("button", { name: "Thêm chuyên mục mới" }).click();
    await page.getByLabel("Tên chuyên mục mới").fill(categoryName);
    await expect(page.getByText(`Đường dẫn: /chuyen-muc-tai-cho-${suffix}`)).toBeVisible();
    await page.getByLabel("Tên chuyên mục mới").press("Enter");
    created.push({ kind: "categories", name: categoryName });
    await expect(page.getByRole("checkbox", { name: categoryName })).toBeChecked();

    await page.getByRole("button", { name: "Thêm thẻ mới" }).click();
    await page.getByLabel("Tên thẻ mới").fill(tagName);
    await page.getByRole("button", { name: "Thêm", exact: true }).click();
    created.push({ kind: "tags", name: tagName });
    await expect(page.getByRole("checkbox", { name: tagName })).toBeChecked();
    // Tạo phân loại không được gửi form bài viết đang soạn.
    await expect(page).toHaveURL(/\/admin\/tin-tuc\/moi$/);
  } finally {
    const response = await page.request.get("/api/admin/taxonomy");
    const { taxonomy } = await response.json() as { taxonomy: Record<"categories" | "tags", Array<{ id: string; name: string }>> };
    for (const item of created) {
      const row = taxonomy[item.kind].find((entry) => entry.name === item.name);
      if (row) expect((await page.request.delete(`/api/admin/taxonomy?kind=${item.kind}&id=${row.id}`, { headers: { origin: new URL(page.url()).origin } })).status()).toBe(200);
    }
  }
});

// Thêm thiết bị khi chưa có nhóm phù hợp: tạo nhóm ngay trong form, nhóm mới được chọn sẵn.
test("Tạo nhóm thiết bị ngay trong form thêm thiết bị", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/thiet-bi/moi");
  const groupName = `Nhóm tại chỗ ${Date.now().toString(36)}`;
  try {
    await page.getByRole("button", { name: "Thêm nhóm thiết bị mới" }).click();
    await page.getByLabel("Tên nhóm thiết bị mới").fill(groupName);
    await page.getByLabel("Tên nhóm thiết bị mới").press("Enter");
    const select = page.getByRole("combobox", { name: "Nhóm thiết bị" });
    await expect(select.locator("option:checked")).toHaveText(groupName);
    await expect(page).toHaveURL(/\/admin\/thiet-bi\/moi$/);
  } finally {
    // Dọn mọi nhóm kiểm thử (kể cả nhóm sót lại từ lần chạy hỏng trước).
    const { equipmentGroups } = await (await page.request.get("/api/admin/equipment?groupsOnly=1")).json() as { equipmentGroups: Array<{ id: string; name: string }> };
    for (const group of equipmentGroups.filter((item) => item.name.startsWith("Nhóm tại chỗ "))) {
      expect((await page.request.delete(`/api/admin/equipment/${group.id}?kind=groups`, { headers: { origin: new URL(page.url()).origin } })).status()).toBe(200);
    }
  }
});
