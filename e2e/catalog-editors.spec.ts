import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Editor Sản phẩm và Thiết bị dùng khuôn 2 cột của bài viết: danh sách mỗi mục một ô (Enter thêm mục),
// FAQ theo cặp câu hỏi/trả lời, thông số theo nhóm. Lưu bản nháp → mở lại → đối chiếu dữ liệu máy chủ.
const stamp = () => Date.now().toString(36);
const box = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

async function expectTwoColumns(page: Page, sideName: string) {
  const side = page.getByRole("complementary", { name: sideName });
  const main = page.locator(".admin-post-editor__main");
  expect((await side.boundingBox())!.x).toBeGreaterThan((await main.boundingBox())!.x + 400);
  return side;
}

test("Sản phẩm: soạn tính năng, FAQ, lưu nháp rồi mở lại đúng dữ liệu", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  await page.goto("/admin/products/new");
  const side = await expectTwoColumns(page, "Thiết lập sản phẩm");
  const origin = new URL(page.url()).origin;
  const name = `Sản phẩm thử editor ${stamp()}`;
  let offeringId: string | undefined;

  try {
    await page.getByLabel("Tên sản phẩm").fill(name);
    await expect(page.locator(".admin-post-editor__path")).toHaveText(/^\/phan-mem\/san-pham-thu-editor-/);
    await page.getByLabel("Tóm tắt").fill("Gọi món nhanh tại bàn.");
    await page.getByLabel("Mô tả chi tiết").fill("Phần mềm gọi món dành cho nhà hàng vừa và nhỏ.");

    // Enter thêm mục ngay bên dưới; Backspace ở ô trống xóa mục.
    await page.getByRole("button", { name: "Thêm tính năng" }).click();
    await box(page, "Tính năng 1").fill("Gọi món bằng QR");
    await box(page, "Tính năng 1").press("Enter");
    await expect(box(page, "Tính năng 2")).toBeFocused();
    await box(page, "Tính năng 2").fill("Báo bếp tức thì");
    await box(page, "Tính năng 2").press("Enter");
    await box(page, "Tính năng 3").press("Backspace");
    await expect(box(page, "Tính năng 3")).toHaveCount(0);
    await page.getByRole("button", { name: "Đưa Tính năng 2 lên" }).click();
    await expect(box(page, "Tính năng 1")).toHaveValue("Báo bếp tức thì");

    await page.getByRole("button", { name: "Thêm câu hỏi" }).click();
    await box(page, "Câu hỏi 1").fill("Có dùng thử không?");
    await box(page, "Trả lời 1").fill("Có, 14 ngày | miễn phí.");

    // Chọn đăng: gợi ý còn thiếu ảnh bìa và lợi ích; quay lại bản nháp để lưu.
    await side.getByRole("radio", { name: /^Đăng ngay/ }).check();
    await expect(side.getByRole("note")).toContainText("Ảnh bìa");
    await expect(side.getByRole("note")).toContainText("Lợi ích");
    await side.getByRole("radio", { name: /^Bản nháp/ }).check();

    await page.getByRole("button", { name: "Lưu nháp" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
    offeringId = page.url().split("/").pop();

    const saved = await (await page.request.get(`/api/admin/offerings/${offeringId}`)).json() as { offering: { content: { features: string[]; faq: [string, string][] } } };
    expect(saved.offering.content.features).toEqual(["Báo bếp tức thì", "Gọi món bằng QR"]);
    expect(saved.offering.content.faq).toEqual([["Có dùng thử không?", "Có, 14 ngày | miễn phí."]]);

    await page.reload();
    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue(name);
    await expect(box(page, "Tính năng 2")).toHaveValue("Gọi món bằng QR");
    await expect(box(page, "Trả lời 1")).toHaveValue("Có, 14 ngày | miễn phí.");
    await expect(page.getByRole("status").filter({ hasText: "Đã lưu · Bản nháp" })).toBeVisible();
  } finally {
    if (offeringId) {
      const current = await (await page.request.get(`/api/admin/offerings/${offeringId}`)).json() as { offering: { draftVersion: number } };
      const archived = await (await page.request.patch(`/api/admin/offerings/${offeringId}`, { headers: { origin }, data: { action: "archive", expectedVersion: current.offering.draftVersion } })).json() as { offering?: { draftVersion: number } };
      expect((await page.request.delete(`/api/admin/offerings/${offeringId}`, { headers: { origin }, data: { expectedVersion: archived.offering?.draftVersion ?? current.offering.draftVersion + 1 } })).status()).toBe(200);
    }
  }
});

test("Thiết bị: nhóm thông số, giá hiển thị, lưu nháp rồi mở lại đúng dữ liệu", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  await page.goto("/admin/equipment/new");
  const origin = new URL(page.url()).origin;
  const groupName = `Nhóm thử editor ${stamp()}`;
  const group = await (await page.request.post("/api/admin/equipment", { headers: { origin }, data: { kind: "groups", id: null, values: { name: groupName, slug: `nhom-thu-editor-${stamp()}`, description: null, coverMediaId: null, sortOrder: 0, isEnabled: false } } })).json() as { id: string };
  let itemId: string | undefined;

  try {
    await page.reload();
    const side = await expectTwoColumns(page, "Thiết lập thiết bị");
    await side.getByRole("combobox", { name: "Nhóm thiết bị" }).selectOption({ label: groupName });
    await page.getByLabel("Tên thiết bị").fill(`Máy POS thử ${stamp()}`);
    await page.getByLabel("Giá bán (VNĐ)").fill("12500000");
    await expect(page.getByText(/Hiện trên website: 12\.500\.000/)).toBeVisible();
    await page.getByLabel("Mô tả ngắn").fill("Máy bán hàng hai màn hình.");

    await page.getByRole("button", { name: "Thêm nhóm thông số" }).click();
    await page.getByLabel("Tên nhóm thông số 1").fill("Kết nối");
    await page.getByLabel("Tên thông số 1 của nhóm 1").fill("Cổng USB");
    await page.getByLabel("Giá trị thông số 1 của nhóm 1").fill("2 cổng");
    await page.getByRole("button", { name: "Thêm thông số" }).click();
    await page.getByLabel("Tên thông số 2 của nhóm 1").fill("Wi-Fi");
    await page.getByLabel("Giá trị thông số 2 của nhóm 1").fill("2.4/5 GHz");

    await page.getByRole("button", { name: "Lưu nháp" }).click();
    await expect(page).toHaveURL(/\/admin\/thiet-bi\/[0-9a-f-]{36}$/);
    itemId = page.url().split("/").pop();

    const saved = await (await page.request.get(`/api/admin/equipment/${itemId}`)).json() as { equipment: { priceVnd: number; groupId: string; specificationGroups: unknown } };
    expect(saved.equipment.priceVnd).toBe(12_500_000);
    expect(saved.equipment.groupId).toBe(group.id);
    expect(saved.equipment.specificationGroups).toEqual([{ title: "Kết nối", items: [{ label: "Cổng USB", value: "2 cổng" }, { label: "Wi-Fi", value: "2.4/5 GHz" }] }]);

    await page.reload();
    await expect(page.getByLabel("Giá trị thông số 2 của nhóm 1")).toHaveValue("2.4/5 GHz");
    await expect(page.getByRole("status").filter({ hasText: "Đã lưu · Bản nháp" })).toBeVisible();
  } finally {
    if (itemId) {
      const current = await (await page.request.get(`/api/admin/equipment/${itemId}`)).json() as { equipment: { version: number } };
      const archived = await (await page.request.patch(`/api/admin/equipment/${itemId}`, { headers: { origin }, data: { action: "archive", expectedVersion: current.equipment.version } })).json() as { equipment?: { version: number } };
      expect((await page.request.delete(`/api/admin/equipment/${itemId}?expectedVersion=${archived.equipment?.version ?? current.equipment.version + 1}`, { headers: { origin } })).status()).toBe(200);
    }
    expect((await page.request.delete(`/api/admin/equipment/${group.id}?kind=groups`, { headers: { origin } })).status()).toBe(200);
  }
});
