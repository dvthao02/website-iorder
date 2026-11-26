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
  // Chỉ một bảng mở tại một thời điểm: focus một mục (như sau khi bấm) rồi rê sang mục có con khác.
  const branches = nav.locator(".site-nav__item--branch");
  if (await branches.count() > 1) {
    await branches.nth(0).locator("> a").focus();
    await branches.nth(1).hover();
    await expect(branches.nth(1).locator(".site-nav__dropdown")).toBeVisible();
    await expect(branches.nth(0).locator(".site-nav__dropdown")).toBeHidden();
    await page.keyboard.press("Escape");
  }

  const footer = page.locator("footer.site-footer");
  await expect(footer.getByRole("list", { name: "Liên hệ iOrder" })).toBeVisible();
  const copyright = footer.getByTestId("site-footer-copyright");
  await expect(copyright).toHaveText(`© ${new Date().getFullYear()} iOrder.vn · Phát triển bởi iOrder.vn · Bản quyền được bảo vệ bởi DMCA`);
  await expect(copyright).not.toContainText("IORDER COMPANY LIMITED");
  await expect(copyright.getByRole("link", { name: "iOrder.vn" })).toHaveAttribute("href", "https://iorder.vn/");
  await expect(footer.getByRole("link", { name: "DMCA" })).toHaveAttribute("href", "https://www.dmca.com/Protection/Status.aspx?ID=55ed00a2-083d-43ee-ac48-18341d415669&refurl=https://iorder.vn/");
  const copyrightBox = await copyright.boundingBox();
  const footerBox = await footer.locator(".site-footer__bottom").boundingBox();
  expect(Math.abs((copyrightBox!.x + copyrightBox!.width / 2) - (footerBox!.x + footerBox!.width / 2))).toBeLessThanOrEqual(1);

  // Nút lên đầu trang chỉ hiện khi đã cuộn.
  // Khung nhìn thấp để trang ngắn vẫn cuộn đủ quá ngưỡng hiện nút.
  await page.setViewportSize({ width: 1440, height: 520 });
  const toTop = page.getByRole("button", { name: "Lên đầu trang" });
  await expect(toTop).not.toHaveClass(/floating-top--visible/);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(toTop).toHaveClass(/floating-top--visible/);

  const contact = page.getByRole("complementary", { name: "Liên hệ nhanh" });
  if (await contact.count() > 0) {
    // Zalo OA tách riêng khỏi menu: luôn hiện, không cần mở bong bóng.
    const zalo = contact.locator(".floating-action--zalo");
    if (await zalo.count()) await expect(zalo).toBeVisible();
    const toggle = page.getByRole("button", { name: "Mở liên hệ nhanh" });
    if (await toggle.count()) {
      await toggle.click();
      await expect(contact.locator(".floating-contact__menu .floating-action").first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
  }

  await toTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
});

test("Header: chữ dễ đọc và không chồng nhau ở các breakpoint máy tính", async ({ page }) => {
  for (const width of [1300, 1440, 1599, 1760, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(webUrl);
    const header = page.locator("header.site-header");
    const brand = header.locator(".brand");
    const links = header.locator(".site-nav__list > li > .site-nav__link");
    const actions = header.locator(".site-header__actions");
    await expect(links.first()).toBeVisible();

    const brandBox = await brand.boundingBox();
    const firstLinkBox = await links.first().boundingBox();
    const lastLinkBox = await links.last().boundingBox();
    const actionsBox = await actions.boundingBox();
    expect(firstLinkBox!.x - (brandBox!.x + brandBox!.width), `Khoảng logo–menu tại ${width}px`).toBeGreaterThanOrEqual(8);
    expect(actionsBox!.x - (lastLinkBox!.x + lastLinkBox!.width), `Khoảng menu–nút tại ${width}px`).toBeGreaterThanOrEqual(8);
    expect(await links.first().evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)), `Cỡ chữ menu tại ${width}px`).toBeGreaterThanOrEqual(width >= 1760 ? 21 : 16);
  }
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

  const footerBottom = page.locator("footer.site-footer .site-footer__bottom");
  const copyright = page.getByTestId("site-footer-copyright");
  await expect(copyright).toHaveText(`© ${new Date().getFullYear()} iOrder.vn · Phát triển bởi iOrder.vn · Bản quyền được bảo vệ bởi DMCA`);
  const copyrightBox = await copyright.boundingBox();
  const footerBox = await footerBottom.boundingBox();
  expect(Math.abs((copyrightBox!.x + copyrightBox!.width / 2) - (footerBox!.x + footerBox!.width / 2))).toBeLessThanOrEqual(1);
});

test("Bàn phím: Tab đầu tiên là \"Bỏ qua tới nội dung chính\", mọi trang có đúng một vùng nội dung chính", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ["/", "/contact", "/news"]) {
    await page.goto(`${webUrl}${path}`);
    await expect(page.locator("main#noi-dung")).toHaveCount(1);
  }
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Bỏ qua tới nội dung chính" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#noi-dung$/);
  // Liên kết chân trang đủ vùng bấm (tối thiểu 24px).
  expect(await page.evaluate(() => [...document.querySelectorAll(".site-footer__column ul a")].filter((link) => link.getBoundingClientRect().height < 24).length)).toBe(0);
});

test("Liên kết tới các trang (/news, /equipment…) không bị tải trước lặp lại; bấm vẫn chuyển trang", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const prefetches = new Map<string, number>();
  page.on("request", (request) => {
    if (!request.headers()["next-router-prefetch"]) return;
    const path = new URL(request.url()).pathname;
    prefetches.set(path, (prefetches.get(path) ?? 0) + 1);
  });
  await page.goto(`${webUrl}/contact`);
  await page.waitForTimeout(4000);
  // Khi URL công khai còn bị rewrite (tiếng Việt → thư mục tiếng Anh), mỗi URL tải trước ~10 lần/giây không dừng; nay không còn rewrite, giữ làm chốt chặn.
  for (const [path, count] of prefetches) expect(count, path).toBeLessThanOrEqual(2);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  const equipment = nav.getByRole("link", { name: "Thiết bị", exact: true });
  test.skip(await equipment.count() === 0, "Menu chưa có mục Thiết bị");
  await equipment.click();
  await expect(page).toHaveURL(/\/equipment$/);
  await expect(page.locator("main#noi-dung h1")).toBeVisible();
});
