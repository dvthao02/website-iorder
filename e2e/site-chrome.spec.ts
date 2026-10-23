import { expect, test } from "@playwright/test";
import { webUrl } from "./helpers";

// Khung website: menu thả xuống, menu điện thoại, chân trang theo menu CMS, nút liên hệ nổi và lên đầu trang.
test("Máy tính: menu thả xuống, chân trang, liên hệ nổi, lên đầu trang", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(webUrl);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  const branch = nav.locator(".site-nav__item--branch").first();
  test.skip(await branch.count() === 0, "Menu đầu trang chưa có mục có con");
  await branch.hover();
  await expect(branch.locator(".site-nav__dropdown")).toBeVisible();

  const footer = page.locator("footer.site-footer");
  await expect(footer.getByRole("region", { name: "Thông tin liên hệ" })).toBeVisible();
  await expect(footer.locator(".site-footer__bottom")).toContainText(`© ${new Date().getFullYear()} Sản phẩm phát triển bởi iOrder.vn`);
  await expect(footer.getByRole("link", { name: "DMCA Protected" })).toHaveAttribute("href", "https://www.dmca.com/Protection/Status.aspx?ID=55ed00a2-083d-43ee-ac48-18341d415669&refurl=https://iorder.vn/");

  // Nút lên đầu trang chỉ hiện khi đã cuộn.
  // Khung nhìn thấp để trang ngắn vẫn cuộn đủ quá ngưỡng hiện nút.
  await page.setViewportSize({ width: 1440, height: 520 });
  const toTop = page.getByRole("button", { name: "Lên đầu trang" });
  await expect(toTop).not.toHaveClass(/floating-top--visible/);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(toTop).toHaveClass(/floating-top--visible/);

  const contact = page.getByRole("complementary", { name: "Liên hệ nhanh" });
  test.skip(await contact.count() === 0, "Chưa cấu hình hotline/Zalo/email");
  await page.getByRole("button", { name: "Mở liên hệ nhanh" }).click();
  await expect(contact.locator(".floating-action").first()).toBeVisible();
  await expect(contact.locator("a[href^='tel:'], a[href^='mailto:'], a[href*='zalo']").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Mở liên hệ nhanh" })).toHaveAttribute("aria-expanded", "false");

  await toTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
});

test("Điện thoại: nút ☰ mở menu toàn màn hình, nhóm gập/mở, không tràn ngang", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(webUrl);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Mở menu" }).click();
  const menu = page.locator("#site-mobile-menu");
  await expect(menu).toBeVisible();
  // Bảng menu phủ gần hết chiều cao màn hình (không bị header cắt).
  expect((await menu.boundingBox())!.height).toBeGreaterThan(600);
  const group = menu.locator("button.site-mobile-menu__link").first();
  if (await group.count()) {
    await group.click();
    await expect(menu.locator(".site-mobile-menu__children")).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Mở liên hệ nhanh" })).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});
