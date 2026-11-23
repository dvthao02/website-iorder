import { expect, test, type Page } from "@playwright/test";

import { startCmsUxBackend } from "./fixtures/cms-ux-backend";

test.describe("Biểu mẫu tư vấn và quảng cáo độc lập với Backend mô phỏng", () => {
  test.skip(process.env.E2E_CMS_UX_FIXTURE !== "1", "Chỉ chạy khi bật Backend mô phỏng.");
  let stop: (() => Promise<void>) | undefined;

  test.beforeAll(async () => {
    if (process.env.E2E_CMS_URL !== "http://127.0.0.1:3101") throw new Error("Audit UX phải dùng CMS riêng tại 127.0.0.1:3101.");
    stop = await startCmsUxBackend();
  });

  test.afterAll(async () => { await stop?.(); });

  test.beforeEach(async ({ request }) => {
    const response = await request.get("/api/v1/admin/session");
    expect(response.headers()["x-iorder-ux-fixture"], "CMS phải trỏ tới Backend mô phỏng trước khi chạy audit.").toBe("1");
  });

  async function expectNoHorizontalOverflow(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  test("hai màn quản lý tách riêng và không tràn ở các kích thước chính", async ({ page }) => {
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });

      await page.goto("/admin/consult-popup");
      await page.waitForLoadState("networkidle");
      const consultEditor = page.getByTestId("consult-form-editor");
      await expect(consultEditor).toBeVisible();
      await expect(page.getByTestId("promotion-popup-editor")).toHaveCount(0);
      await expect(consultEditor.getByRole("checkbox", { name: "Bật biểu mẫu tư vấn" })).toBeVisible();
      await expect(consultEditor.locator(".admin-editor-section")).toHaveCount(2);
      await expect(consultEditor.getByTestId("popup-preview")).toBeVisible();
      await expect(consultEditor.getByTestId("popup-sibling-note")).toContainText("Quảng cáo đang tắt");
      await expect(consultEditor.locator('[data-testid^="promotion-layout-"]')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await consultEditor.screenshot({ animations: "disabled", path: `test-results/consult-form-editor-${width}.png` });

      await page.goto("/admin/promotion-popup");
      await page.waitForLoadState("networkidle");
      const promotionEditor = page.getByTestId("promotion-popup-editor");
      await expect(promotionEditor).toBeVisible();
      await expect(page.getByTestId("consult-form-editor")).toHaveCount(0);
      await expect(promotionEditor.getByRole("checkbox", { name: "Bật quảng cáo" })).toBeVisible();
      await expect(promotionEditor.locator(".admin-editor-section")).toHaveCount(2);
      await expect(promotionEditor.getByTestId("popup-preview")).toBeVisible();
      await expect(promotionEditor.getByTestId("popup-sibling-note")).toContainText("Biểu mẫu tư vấn đang bật");
      await expect(promotionEditor.locator('[data-testid^="promotion-layout-"]')).toHaveCount(5);
      for (const layout of ["card", "split", "image", "compact", "bar"]) {
        const preview = promotionEditor.getByTestId(`promotion-preview-${layout}`);
        await expect(preview).toBeVisible();
        const previewBox = await preview.boundingBox();
        expect(previewBox).not.toBeNull();
        expect(previewBox!.width).toBeGreaterThanOrEqual(180);
        expect(previewBox!.height).toBeGreaterThanOrEqual(100);
      }
      await expectNoHorizontalOverflow(page);
      await promotionEditor.locator(".admin-consult-popup__layout-choices").screenshot({ animations: "disabled", path: `test-results/promotion-layout-choices-${width}.png` });
    }
  });

  test("bản xem trước quảng cáo theo sát nội dung, bố cục và ảnh đang chọn", async ({ context, page }) => {
    await context.addCookies([{ name: "ux-promo-image", value: "1", url: process.env.E2E_CMS_URL! }]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/promotion-popup");
    await page.waitForLoadState("networkidle");
    const editor = page.getByTestId("promotion-popup-editor");
    const preview = editor.getByTestId("popup-preview");

    await expect(editor.getByTestId("popup-sibling-note")).toContainText("hộp nào đủ điều kiện trước sẽ hiện");
    await expect(preview.locator(".popup-preview__panel--split")).toBeVisible();
    await expect(preview.locator(".popup-preview__media img")).toBeVisible();
    await expect(preview).toContainText("Ưu đãi triển khai tháng này");
    await expect(preview).toContainText("Nhận ưu đãi");

    await editor.getByLabel("Tiêu đề quảng cáo").fill("Giảm 20% tháng 12");
    await expect(preview).toContainText("Giảm 20% tháng 12");
    await expect(editor.getByRole("status").last()).toHaveText("Có thay đổi chưa lưu.");

    await editor.getByTestId("promotion-layout-bar").click();
    await expect(preview.locator(".popup-preview__panel--bar")).toBeVisible();
    await expect(preview.locator(".popup-preview__ghost")).toHaveCount(0);

    await editor.getByTestId("promotion-layout-image").click();
    await expect(preview.locator(".popup-preview__banner img")).toBeVisible();
    await expect(preview.locator(".popup-preview__copy")).toHaveCount(0);

    await editor.getByTestId("promotion-layout-compact").click();
    await expect(preview.locator(".popup-preview__panel--compact")).toBeVisible();
    await expect(preview.locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
