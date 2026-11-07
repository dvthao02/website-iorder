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

  const guides = page.locator(".support-step");
  test.skip(await guides.count() === 0, "Chưa có bài hướng dẫn được xuất bản");
  const first = (await guides.first().locator(".text-lead").textContent())!.trim();
  // Gõ không dấu, chữ thường: vẫn ra đúng bài.
  const folded = first.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  await page.getByRole("searchbox").fill(folded);
  await expect(page.locator(".support-search__result").first()).toContainText(first);
  await page.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/ho-tro\/huong-dan\/.+/);
});
