import { expect, test } from "@playwright/test";

import { startCmsUxBackend } from "./fixtures/cms-ux-backend";

const layouts = ["card", "image", "split", "compact", "bar"] as const;
const selectedLayout = process.env.E2E_POPUP_LAYOUT as typeof layouts[number] | undefined;
// E2E_POPUP_MEDIA=broken: ảnh quảng cáo trả 404 để kiểm tra cách website xử lý ảnh hỏng.
const brokenMedia = process.env.E2E_POPUP_MEDIA === "broken";

test.describe("Bố cục quảng cáo trên website với Backend mô phỏng", () => {
  test.skip(!selectedLayout || !layouts.includes(selectedLayout), "Cần chọn E2E_POPUP_LAYOUT hợp lệ.");
  let stop: (() => Promise<void>) | undefined;

  test.beforeAll(async ({ request }) => {
    stop = await startCmsUxBackend();
    const response = await request.get(`http://127.0.0.1:3102/__fixture/consult-popup?layout=${selectedLayout}${brokenMedia ? "&media=broken" : ""}`);
    expect(response.ok()).toBe(true);
  });

  test.afterAll(async () => { await stop?.(); });

  test(`mẫu ${selectedLayout ?? "chưa chọn"} hiển thị đúng trên điện thoại và desktop`, async ({ page }) => {
    test.skip(brokenMedia, "Kịch bản ảnh hỏng có kiểm tra riêng.");
    const website = process.env.E2E_WEB_URL;
    if (website !== "http://127.0.0.1:3100") throw new Error("Audit popup phải dùng website riêng tại 127.0.0.1:3100.");
    await page.addInitScript(() => { window.localStorage.clear(); window.sessionStorage.clear(); });

    for (const width of [390, 900]) {
      await page.setViewportSize({ width, height: 820 });
      await page.goto(website);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

      const dialog = page.getByTestId("consult-popup-dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("data-layout", selectedLayout!);
      // Hộp chỉ hiện sau khi ảnh đã tải xong: không có khung trắng chỉ có nút đóng rồi nội dung nhảy vào.
      for (const image of await dialog.locator("img").all()) {
        expect(await image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0 && element.getBoundingClientRect().width > 0)).toBe(true);
      }
      if (selectedLayout === "card" || selectedLayout === "split" || selectedLayout === "image") await expect(dialog.locator("img").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      const geometry = await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const action = element.querySelector<HTMLElement>(".consult-popup__actions")?.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, height: box.height, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, actionTop: action?.top, actionBottom: action?.bottom, viewportHeight: innerHeight };
      });
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
      expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
      if (selectedLayout !== "image") expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);

      if (selectedLayout === "bar") {
        await expect(dialog).not.toHaveAttribute("aria-modal", "true");
        expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
      } else {
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      }
      if (selectedLayout === "split") await expect(dialog.locator(".consult-popup__media")).toBeVisible();

      await page.screenshot({ animations: "disabled", path: `test-results/consult-popup-${selectedLayout}-${width}.png` });
      await dialog.getByRole("button", { name: "Đóng cửa sổ", exact: true }).click();
      await expect(dialog).toHaveCount(0);
    }
  });

  test(`ảnh quảng cáo hỏng: ${selectedLayout ?? "chưa chọn"} xử lý gọn, không để lại khung trống`, async ({ page }) => {
    test.skip(!brokenMedia, "Chỉ chạy khi E2E_POPUP_MEDIA=broken.");
    const website = process.env.E2E_WEB_URL;
    if (website !== "http://127.0.0.1:3100") throw new Error("Audit popup phải dùng website riêng tại 127.0.0.1:3100.");
    await page.addInitScript(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
    await page.setViewportSize({ width: 900, height: 820 });
    await page.goto(website);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    const dialog = page.getByTestId("consult-popup-dialog");
    if (selectedLayout === "card") {
      // Thẻ tiêu chuẩn vẫn đủ nội dung chữ và nút, chỉ thiếu ảnh.
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await expect(dialog.locator(".consult-popup__media")).toHaveCount(0);
      await expect(dialog.getByRole("link", { name: "Xem giải pháp" })).toBeVisible();
    } else {
      // Bố cục lấy ảnh làm nội dung: bỏ lần này, không hiện hộp trống, và trang vẫn dùng được.
      await page.waitForTimeout(6_000);
      await expect(dialog).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    }
  });
});
