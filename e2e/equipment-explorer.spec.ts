import { expect, test } from "@playwright/test";
import { webUrl } from "./helpers";

// Trang Thiết bị: lưới thẻ theo nhóm; bấm thẻ mở khung chi tiết ngay dưới hàng (mũi nhọn chỉ đúng thẻ),
// Esc đóng và trả focus về thẻ; thẻ vẫn là liên kết tới trang chi tiết. Chỉ đọc, không đổi dữ liệu.
test("Thiết bị: bấm thẻ mở chi tiết ngay dưới hàng, Esc đóng, thẻ vẫn là liên kết", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${webUrl}/thiet-bi`);
  const tiles = page.locator(".equipment-tile");
  test.skip(await tiles.count() === 0, "Chưa có thiết bị được xuất bản");
  const tile = tiles.first();
  await expect(tile).toHaveAttribute("href", /^\/thiet-bi\/.+/);
  await expect(tile).toHaveAttribute("aria-expanded", "false");

  await tile.click();
  await expect(page).toHaveURL(/\/thiet-bi$/);
  await expect(tile).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByRole("region", { name: /^Chi tiết / });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: /Xem trang chi tiết/ })).toHaveAttribute("href", (await tile.getAttribute("href"))!);
  // Mũi nhọn của khung nằm thẳng dưới thẻ đang chọn.
  const offset = await page.evaluate(() => {
    const box = document.querySelector(".equipment-panel")!.getBoundingClientRect();
    const card = document.querySelector(".equipment-tile--active")!.getBoundingClientRect();
    return Math.abs(box.left + parseFloat(getComputedStyle(document.querySelector(".equipment-panel")!, "::before").left) - (card.left + card.width / 2));
  });
  expect(offset).toBeLessThan(6);

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(tile).toBeFocused();
  // Bàn phím: Enter trên thẻ cũng mở chi tiết (không rời trang).
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: /^Chi tiết / })).toBeVisible();
  await expect(page).toHaveURL(/\/thiet-bi$/);
});
