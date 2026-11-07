import { expect, test } from "@playwright/test";
import { webUrl } from "./helpers";

// Tin tức: chủ đề, khối nổi bật, trang chủ đề, bài viết (thời gian đọc, chia sẻ, bài liên quan). Chỉ đọc.
test("Tin tức: thanh chủ đề, bài nổi bật, trang chủ đề và bài viết", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto(`${webUrl}/tin-tuc`);
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  const lead = page.locator(".news-lead");
  test.skip(await lead.count() === 0, "Chưa có bài viết được xuất bản");
  const topics = page.getByRole("navigation", { name: "Chủ đề tin tức" });
  await expect(topics.getByRole("link", { name: "Tất cả" })).toHaveAttribute("aria-current", "page");
  // Trang không tồn tại thì 404, tham số sai coi là trang 1.
  expect((await page.request.get(`${webUrl}/tin-tuc?trang=999`)).status()).toBe(404);
  expect((await page.request.get(`${webUrl}/tin-tuc?trang=abc`)).status()).toBe(200);

  const topic = topics.getByRole("link").nth(1);
  if (await topic.count()) {
    const name = (await topic.textContent())!.replace(/\d+$/, "").trim();
    await topic.click();
    await expect(page).toHaveURL(/\/tin-tuc\/chuyen-muc\/.+/);
    await expect(page.locator("h1")).toHaveText(name);
    await expect(page.getByRole("navigation", { name: "Chủ đề tin tức" }).locator('[aria-current="page"]')).toContainText(name);
    await page.goBack();
  }

  const title = (await lead.locator(".news-lead__title").textContent())!.trim();
  await lead.click();
  await expect(page).toHaveURL(/\/tin-tuc\/.+/);
  await expect(page.locator("h1")).toHaveText(title);
  await expect(page.getByText(/\d+ phút đọc/)).toBeVisible();
  await expect(page.getByRole("group", { name: "Chia sẻ bài viết" }).getByRole("button", { name: "Sao chép liên kết" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bài viết liên quan" })).toBeVisible();
});
