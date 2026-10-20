import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

// Thư viện media: chuyển lưới/danh sách (nhớ lựa chọn), và ảnh đang chèn trong nội dung bài viết
// được báo "đang dùng", không xóa được (trước đây chỉ kiểm ảnh bìa/logo nên ảnh trong bài bị xóa mất).
test("Thư viện media: lưới/danh sách, ảnh trong nội dung bài viết không xóa được", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  const origin = baseURL!;
  const stamp = Date.now();
  const name = `e2e-trong-bai-${stamp}.png`;
  let postId: string | undefined;
  let assetId: string | undefined;
  try {
    const upload = await page.request.post("/api/admin/media", { headers: { origin }, multipart: { file: { name, mimeType: "image/png", buffer: tinyPng } } });
    const asset = ((await upload.json()) as { asset: { id: string; url: string } }).asset;
    assetId = asset.id;
    const created = await page.request.post("/api/admin/posts", { headers: { origin }, data: {
      type: "news", title: `Bài có ảnh ${stamp}`, slug: `e2e-bai-co-anh-${stamp}`, excerpt: null, status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null,
      promotionStartAt: null, promotionEndAt: null, ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null, categoryIds: [], tagIds: [], coverMediaId: null,
      content: { version: 2, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Có ảnh bên dưới." }] }, { type: "image", attrs: { src: asset.url, width: 50, align: "center" } }] } },
    } });
    expect(created.status()).toBe(201);
    postId = ((await created.json()) as { post: { id: string } }).post.id;

    // Máy chủ chặn xóa vì ảnh đang nằm trong nội dung bài.
    const blocked = await page.request.delete(`/api/admin/media/${asset.id}`, { headers: { origin } });
    expect(blocked.status()).toBe(409);

    await page.goto(`/admin/media?query=${encodeURIComponent(`e2e-trong-bai-${stamp}`)}`);
    await page.getByRole("button", { name: "Lưới", exact: true }).click();
    const tile = page.getByRole("button", { name: `Xem chi tiết ${name}` });
    await expect(tile).toBeVisible();
    await tile.click();
    const panel = page.getByRole("dialog", { name: "Chi tiết tệp" });
    await expect(panel.getByText("Đang dùng tại 1 nơi")).toBeVisible();
    await expect(panel.getByText(`Ảnh trong nội dung bài viết: Bài có ảnh ${stamp}`)).toBeVisible();
    await expect(panel.getByRole("button", { name: "Xóa tệp" })).toBeDisabled();
    await page.screenshot({ path: "test-results/media-grid-panel.png" });
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);

    // Danh sách dạng bảng; lựa chọn được nhớ khi tải lại trang.
    await page.getByRole("button", { name: "Danh sách", exact: true }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("table").getByText(name)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Danh sách", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("table")).toBeVisible();
    await page.screenshot({ path: "test-results/media-list.png" });
    await page.getByRole("button", { name: "Lưới", exact: true }).click();
  } finally {
    if (postId) {
      const current = await (await page.request.get(`/api/admin/posts/${postId}`)).json() as { post?: { draftVersion: number } };
      if (current.post) {
        const archived = await (await page.request.patch(`/api/admin/posts/${postId}`, { headers: { origin }, data: { action: "archive", expectedVersion: current.post.draftVersion } })).json() as { post?: { draftVersion: number } };
        await page.request.delete(`/api/admin/posts/${postId}`, { headers: { origin }, data: { expectedVersion: archived.post?.draftVersion ?? current.post.draftVersion + 1 } });
      }
    }
    if (assetId) await page.request.delete(`/api/admin/media/${assetId}`, { headers: { origin } });
  }
});

test("Thư viện media: tải nhiều tệp, lọc ảnh thiếu mô tả, xem trước/sau bằng phím, chọn nhiều để xóa", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  const stamp = Date.now();
  const names = [1, 2, 3].map((index) => `e2e-nhieu-${stamp}-${index}.png`);
  try {
    await page.goto("/admin/media");
    await page.getByRole("button", { name: "Lưới", exact: true }).click();
    await page.getByLabel("Chọn ảnh hoặc tài liệu").setInputFiles(names.map((name) => ({ name, mimeType: "image/png", buffer: tinyPng })));
    await expect(page.getByText("Đã chọn 3 tệp")).toBeVisible();
    await page.getByRole("button", { name: "Tải lên" }).click();
    await expect(page.locator(".admin-toast").filter({ hasText: "Đã tải lên 3 tệp." })).toBeVisible();

    // Chỉ xem ảnh thiếu mô tả của lần tải này.
    await page.getByLabel("Tìm tệp").fill(`e2e-nhieu-${stamp}`);
    await page.getByLabel("Tìm tệp").press("Enter");
    await page.getByLabel("Lọc loại tệp").selectOption("missing_alt");
    const tiles = page.getByRole("button", { name: /^Xem chi tiết e2e-nhieu-/ });
    await expect(tiles).toHaveCount(3);

    // Khung chi tiết: kích thước ảnh, cảnh báo ảnh nhỏ, chuyển tệp bằng phím →.
    await tiles.first().click();
    const panel = page.getByRole("dialog", { name: "Chi tiết tệp" });
    await expect(panel.getByText("1 × 1 px", { exact: false })).toBeVisible();
    await expect(panel.getByText(/Ảnh nhỏ/)).toBeVisible();
    const firstName = await panel.getByRole("heading").textContent();
    await expect(panel.getByText("1/3")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(panel.getByText("2/3")).toBeVisible();
    await expect(panel.getByRole("heading")).not.toHaveText(firstName!);
    await panel.getByLabel("Mô tả thay thế ảnh").fill("Đã có mô tả");
    await panel.getByRole("button", { name: "Lưu thông tin" }).click();
    await expect(page.locator(".admin-toast").filter({ hasText: "Đã lưu thông tin tệp." })).toBeVisible();
    await page.keyboard.press("Escape");

    // Tải lại bộ lọc: ảnh vừa thêm mô tả không còn trong "Ảnh thiếu mô tả".
    await page.getByLabel("Lọc loại tệp").selectOption("all");
    await page.getByLabel("Lọc loại tệp").selectOption("missing_alt");
    await expect(tiles).toHaveCount(2);

    // Chọn tất cả trên trang rồi xóa hàng loạt.
    await page.getByLabel("Chọn tất cả trên trang").check();
    const bulk = page.getByRole("region", { name: "Thao tác với các dòng đã chọn" });
    await expect(bulk.getByText("Đã chọn 2")).toBeVisible();
    await bulk.getByRole("button", { name: "Xóa tệp đã chọn" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Xóa" }).click();
    await expect(page.locator(".admin-toast").filter({ hasText: "Đã xóa 2 tệp." })).toBeVisible();
    await expect(tiles).toHaveCount(0);
    await page.getByLabel("Lọc loại tệp").selectOption("all");
    await expect(tiles).toHaveCount(1);
    await page.screenshot({ path: "test-results/media-features.png" });
  } finally {
    const media = await (await page.request.get(`/api/admin/media?query=${encodeURIComponent(`e2e-nhieu-${stamp}`)}`)).json() as { assets: Array<{ id: string }> };
    for (const asset of media.assets) await page.request.delete(`/api/admin/media/${asset.id}`, { headers: { origin: baseURL! } });
  }
});
