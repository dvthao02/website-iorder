import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin, webUrl } from "./helpers";

// Ảnh PNG 1×1 hợp lệ để thử upload.
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("Thư viện media: tải ảnh lên, sửa mô tả (chặn ghi đè bản cũ), rồi xóa", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `e2e-media-${Date.now()}.png`;
  await page.goto("/admin/media");
  await page.getByLabel("Chọn ảnh hoặc tài liệu").setInputFiles({ name, mimeType: "image/png", buffer: tinyPng });
  await page.getByRole("button", { name: "Tải lên" }).click();
  // Tải xong tự mở khung chi tiết để thêm mô tả ngay.
  const editor = page.getByRole("dialog", { name: "Chi tiết tệp" });
  await expect(editor.getByRole("heading", { name })).toBeVisible();
  await expect(editor.getByText("Chưa được dùng ở đâu.")).toBeVisible();

  await editor.getByLabel("Mô tả thay thế ảnh").fill("Ảnh kiểm thử E2E");
  await editor.getByRole("button", { name: "Lưu thông tin" }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: "Đã lưu thông tin tệp." })).toBeVisible();

  // Gửi lại với phiên bản cũ (0) như một phiên khác chưa tải lại → 409.
  const origin = new URL(page.url()).origin;
  const list = await (await page.request.get(`/api/admin/media?query=${encodeURIComponent(name)}`)).json() as { assets: Array<{ id: string; version: number; originalName: string }> };
  const asset = list.assets.find((item) => item.originalName === name)!;
  expect(asset.version).toBe(1);
  const stale = await page.request.patch(`/api/admin/media/${asset.id}`, { headers: { origin }, data: { altText: "Ghi đè", caption: null, expectedVersion: 0 } });
  expect(stale.status()).toBe(409);
  expect(((await stale.json()) as { error: { code: string } }).error.code).toBe("VERSION_CONFLICT");

  await editor.getByRole("button", { name: "Xóa tệp" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Xem chi tiết ${name}` })).toHaveCount(0);
});

async function removePost(request: APIRequestContext, origin: string, id: string) {
  const current = await (await request.get(`/api/admin/posts/${id}`)).json() as { post?: { status: string; draftVersion: number } };
  if (!current.post) return;
  let version = current.post.draftVersion;
  if (current.post.status !== "archived") {
    const archived = await (await request.patch(`/api/admin/posts/${id}`, { headers: { origin }, data: { action: "archive", expectedVersion: version } })).json() as { post?: { draftVersion: number } };
    version = archived.post?.draftVersion ?? version + 1;
  }
  await request.delete(`/api/admin/posts/${id}`, { headers: { origin }, data: { expectedVersion: version } });
}

const createdPosts: string[] = [];
test.afterEach(async ({ page, baseURL }) => {
  for (const id of createdPosts.splice(0)) await removePost(page.request, baseURL!, id);
});

test("Xuất bản bài viết trong CMS rồi thấy ngay trên website", async ({ page }) => {
  await loginAsAdmin(page);
  const origin = new URL(page.url()).origin;
  const slug = `e2e-xuat-ban-${Date.now()}`;
  const title = `Bài kiểm thử xuất bản ${slug}`;
  const response = await page.request.post("/api/admin/posts", { headers: { origin }, data: {
    type: "news", title, slug, excerpt: "Tóm tắt kiểm thử.", content: { version: 1, blocks: [{ type: "paragraph", text: "Đoạn nội dung hiển thị trên website." }] },
    status: "published", seoTitle: null, seoDescription: null, canonicalUrl: null, promotionStartAt: null, promotionEndAt: null,
    ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null, categoryIds: [], tagIds: [],
  } });
  expect(response.status()).toBe(201);
  createdPosts.push(((await response.json()) as { post: { id: string } }).post.id);

  const publicPage = await page.context().newPage();
  await publicPage.goto(`${webUrl}/tin-tuc/${slug}`);
  await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(publicPage.getByText("Đoạn nội dung hiển thị trên website.")).toBeVisible();
  await publicPage.close();
});

test("Xem trước bản nháp: chỉ người có liên kết từ CMS thấy, có thanh báo và noindex", async ({ page, browser }) => {
  await loginAsAdmin(page);
  const origin = new URL(page.url()).origin;
  const slug = `e2e-xem-truoc-${Date.now()}`;
  const title = `Bản nháp xem trước ${slug}`;
  const response = await page.request.post("/api/admin/posts", { headers: { origin }, data: {
    type: "news", title, slug, excerpt: null, content: { version: 1, blocks: [{ type: "paragraph", text: "Nội dung nháp chưa công khai." }] },
    status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null, promotionStartAt: null, promotionEndAt: null,
    ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null, categoryIds: [], tagIds: [],
  } });
  expect(response.status()).toBe(201);
  const id = ((await response.json()) as { post: { id: string } }).post.id;
  createdPosts.push(id);

  // Khách thường: bài nháp không tồn tại.
  const visitor = await browser.newContext();
  expect((await (await visitor.newPage()).goto(`${webUrl}/tin-tuc/${slug}`))?.status()).toBe(404);
  // Token giả hoặc bị sửa: bị từ chối, không bật chế độ xem trước.
  expect((await visitor.request.get(`${webUrl}/api/preview?token=v1.abc.def`, { maxRedirects: 0 })).status()).toBe(404);
  await visitor.close();

  await page.goto(`/admin/tin-tuc/${id}`);
  const [preview] = await Promise.all([page.context().waitForEvent("page"), page.getByRole("button", { name: /Xem trước bản nháp/ }).click()]);
  await preview.waitForURL(new RegExp(`/tin-tuc/${slug}$`));
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(preview.getByText("Nội dung nháp chưa công khai.")).toBeVisible();
  await expect(preview.getByRole("status").filter({ hasText: "Đang xem bản nháp." })).toBeVisible();
  await expect(preview.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);

  await preview.getByRole("button", { name: "Thoát xem trước" }).click();
  await preview.waitForLoadState();
  await expect(preview.getByText("Nội dung nháp chưa công khai.")).toHaveCount(0);
  await preview.close();
});
