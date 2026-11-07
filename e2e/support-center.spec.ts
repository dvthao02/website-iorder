import { expect, test } from "@playwright/test";
import { webUrl } from "./helpers";

// Trung tâm hỗ trợ (/ho-tro): dựng từ dữ liệu CMS; ô tìm nhanh khớp không dấu và Enter mở kết quả đầu. Chỉ đọc.
test("Trung tâm hỗ trợ: các kênh hỗ trợ, tìm không dấu, Enter mở kết quả đầu tiên", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto(`${webUrl}/ho-tro`);
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", /\/ho-tro$/);
  await expect(page.locator(".support-channel").filter({ hasText: "Gửi yêu cầu hỗ trợ" })).toHaveAttribute("href", "/lien-he");

  // "Làm quen với iOrder": thẻ trượt có Bước n, tên bài, Xem bài viết.
  const guides = page.locator(".support-guide");
  test.skip(await guides.count() === 0, "Chưa có bài hướng dẫn được xuất bản");
  await expect(guides.first()).toContainText("Bước 1");
  await expect(guides.first()).toContainText("Xem bài viết");
  await expect(page.getByRole("button", { name: "Xem các bước trước" })).toBeDisabled();
  const first = (await guides.first().locator(".text-lead").textContent())!.trim();
  // Gõ không dấu, chữ thường: vẫn ra đúng bài.
  const folded = first.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  await page.getByRole("searchbox").fill(folded);
  await expect(page.locator(".support-search__result").first()).toContainText(first);
  await page.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/ho-tro\/huong-dan\/.+/);
});

// Hướng dẫn sử dụng dạng tài liệu: danh mục nhóm bên trái, bài đang xem được tô, mục lục bên phải nhảy tới đúng tiêu đề. Chỉ đọc.
test("Hướng dẫn: danh mục bên trái, bài đang xem được tô, mục lục bám theo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto(`${webUrl}/ho-tro/huong-dan`);
  expect(response?.status()).toBe(200);
  const cards = page.locator(".guide-card");
  test.skip(await cards.count() === 0, "Chưa có bài hướng dẫn được xuất bản");
  await expect(page.getByRole("navigation", { name: "Danh mục hướng dẫn" })).toBeVisible();
  const title = (await cards.first().locator(".font-bold").textContent())!.trim();
  await cards.first().click();
  await expect(page).toHaveURL(/\/ho-tro\/huong-dan\/.+/);
  await expect(page.locator("h1")).toHaveText(title);
  await expect(page.locator('.guide-docs__side .guide-nav__link[aria-current="page"]')).toHaveText(title);
  const toc = page.locator(".guide-docs__toc .article-toc a");
  if (await toc.count() >= 2) {
    const target = toc.nth(1);
    const id = (await target.getAttribute("href"))!.slice(1);
    await target.click();
    await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
  }
});
