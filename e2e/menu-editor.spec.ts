import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Menu & Điều hướng (kiểu Shopify/WordPress): sửa ngay trên trang, ô liên kết tìm trang hoặc dán đường dẫn,
// thêm nhanh trang có sẵn, đổi cấp, thu gọn nhánh, thao tác nhanh trên dòng. Chỉ thao tác trên form rồi bỏ thay đổi.
test("Menu: sửa trên trang, tìm & liên kết trang, thêm nhanh, đổi cấp, thu gọn, ẩn nhanh, bỏ thay đổi", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  await page.goto("/admin/menu");
  const form = page.getByRole("region", { name: "Sửa mục menu" });
  const preview = page.getByRole("group", { name: "Xem trước trên website" });
  const rows = page.locator(".admin-nav-row");
  await expect(form).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const initialCount = await rows.count();

  // Đổi nhãn: xem trước và trạng thái lưu cập nhật ngay.
  const first = rows.first().locator(".admin-nav-row__main");
  const original = (await first.locator("strong").textContent())!;
  await first.click();
  await form.getByLabel("Nhãn hiển thị").fill(`${original} (thử)`);
  await expect(preview.getByRole("button", { name: `${original} (thử)` })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Có thay đổi chưa lưu trong menu đầu trang." })).toBeVisible();

  // Mục mới: gõ để tìm trang rồi chọn → liên kết trực tiếp.
  await page.getByRole("button", { name: "Thêm mục", exact: true }).click();
  const link = form.getByRole("combobox", { name: "Liên kết" });
  await link.fill("tin-tuc");
  const option = form.getByRole("option").filter({ hasText: "/tin-tuc" }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(form.getByRole("button", { name: "Đổi liên kết" })).toBeVisible();
  await expect(form.getByText(/Liên kết trực tiếp/)).toBeVisible();

  // Đổi cấp: vào trong (thành mục con của mục phía trên) rồi ra ngoài.
  await form.getByRole("button", { name: "Đưa vào trong" }).click();
  await expect(form.getByText(/^Mục con của/)).toBeVisible();
  const childRow = rows.filter({ has: page.locator("svg.lucide-corner-down-right") }).last();
  await expect(childRow).toBeVisible();
  // Thu gọn nhánh cha: mục con ẩn khỏi cây.
  const parentToggle = page.getByRole("button", { name: /^Thu gọn / }).last();
  await parentToggle.click();
  await expect(page.getByRole("button", { name: /^Mở / }).last()).toBeVisible();
  await page.getByRole("button", { name: /^Mở / }).last().click();
  await form.getByRole("button", { name: "Đưa ra ngoài" }).click();
  await expect(form.getByText("Mục cấp 1")).toBeVisible();

  // Thêm nhanh trang có sẵn (tick rồi thêm một lần).
  await page.getByRole("button", { name: "Thêm nhanh trang có sẵn" }).click();
  const quick = page.getByRole("group", { name: "Thêm nhanh trang có sẵn" });
  await quick.getByRole("checkbox").first().check();
  await quick.getByRole("button", { name: "Thêm 1 mục vào menu" }).click();
  await expect(rows).toHaveCount(initialCount + 2);

  // Ẩn nhanh ngay trên dòng.
  const lastLabel = (await rows.last().locator("strong").textContent())!;
  await rows.last().hover();
  await page.getByRole("button", { name: `Ẩn ${lastLabel}` }).click();
  await expect(rows.last().getByText("Ẩn", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/menu-editor.png" });

  // Bỏ thay đổi: trở về như đã lưu.
  await page.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(rows).toHaveCount(initialCount);
  await expect(rows.first().locator("strong")).toHaveText(original);
  await expect(page.getByRole("status").filter({ hasText: /Đã lưu · Phiên bản/ })).toBeVisible();
});
