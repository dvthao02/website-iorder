import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const marker = `E2E bảng ${Date.now()}`;

function draftPost(title: string, slug: string) {
  return { type: "news", title, slug, excerpt: null, content: { version: 1, blocks: [{ type: "paragraph", text: "Nội dung kiểm thử." }] }, status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null, promotionStartAt: null, promotionEndAt: null, ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null, categoryIds: [], tagIds: [] };
}

async function removePost(request: APIRequestContext, origin: string, id: string) {
  const headers = { origin };
  const current = await (await request.get(`/api/admin/posts/${id}`)).json() as { post?: { status: string; draftVersion: number } };
  if (!current.post) return;
  let version = current.post.draftVersion;
  if (current.post.status !== "archived") {
    const archived = await (await request.patch(`/api/admin/posts/${id}`, { headers, data: { action: "archive", expectedVersion: version } })).json() as { post?: { draftVersion: number } };
    version = archived.post?.draftVersion ?? version + 1;
  }
  await request.delete(`/api/admin/posts/${id}`, { headers, data: { expectedVersion: version } });
}

// Dọn ở hook riêng (có thời gian chạy riêng) để bài thử không sót lại kể cả khi test hết giờ.
const ids: string[] = [];
test.afterEach(async ({ page, baseURL }) => {
  for (const id of ids.splice(0)) await removePost(page.request, baseURL!, id);
});

test("Bảng danh sách: sắp xếp, ghim cột ở tiêu đề, chọn nhiều và lưu trữ/khôi phục hàng loạt", async ({ page }) => {
  await loginAsAdmin(page);
  const origin = new URL(page.url()).origin;
  {
    for (const [suffix, slug] of [["A", "a"], ["B", "b"]]) {
      const response = await page.request.post("/api/admin/posts", { headers: { origin }, data: draftPost(`${marker} ${suffix}`, `e2e-bang-${Date.now()}-${slug}`) });
      expect(response.status()).toBe(201);
      ids.push(((await response.json()) as { post: { id: string } }).post.id);
    }

    await page.goto(`/admin/tin-tuc?query=${encodeURIComponent(marker)}&sort=title&dir=asc`);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText(`${marker} A`);
    const titleHeader = page.locator("thead th").filter({ hasText: "Tiêu đề" });
    await expect(titleHeader).toHaveAttribute("aria-sort", "ascending");

    // Bấm tiêu đề cột đang sắp tăng → đổi sang giảm, URL cập nhật.
    await titleHeader.getByRole("button", { name: "Tiêu đề", exact: true }).click();
    await expect(page).toHaveURL(/dir=desc/);
    await expect(rows.first()).toContainText(`${marker} B`);

    // Ghim rồi bỏ ghim cột ngay trên tiêu đề.
    const typeHeader = page.locator("thead th").filter({ hasText: "Loại" });
    await typeHeader.hover();
    await typeHeader.getByRole("button", { name: "Ghim cột Loại" }).click();
    await expect(typeHeader.getByRole("button", { name: "Bỏ ghim cột Loại" })).toHaveAttribute("aria-pressed", "true");
    await typeHeader.getByRole("button", { name: "Bỏ ghim cột Loại" }).click();
    await expect(typeHeader.getByRole("button", { name: "Ghim cột Loại" })).toHaveAttribute("aria-pressed", "false");

    // Chọn tất cả → lưu trữ hàng loạt (có hộp xác nhận).
    await page.getByLabel("Chọn tất cả dòng trên trang").check();
    const bulkBar = page.getByRole("region", { name: "Thao tác với các dòng đã chọn" });
    await expect(bulkBar).toContainText("Đã chọn 2");
    await bulkBar.getByRole("button", { name: "Lưu trữ (2)" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Lưu trữ" }).click();
    await expect(rows.filter({ hasText: "Lưu trữ" })).toHaveCount(2);
    await expect(bulkBar).toHaveCount(0);

    // Khôi phục hàng loạt.
    await page.getByLabel("Chọn tất cả dòng trên trang").check();
    await bulkBar.getByRole("button", { name: "Khôi phục (2)" }).click();
    await expect(rows.filter({ hasText: "Bản nháp" })).toHaveCount(2);
  }
});

test("Thanh lọc: bộ lọc phụ trong \"Bộ lọc khác\", nhãn bộ lọc gỡ từng cái và xóa tất cả", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/nhat-ky?verb=login&from=2026-01-01&to=2026-12-31");
  const chips = page.getByRole("group", { name: "Bộ lọc đang áp dụng" });
  await expect(chips).toContainText("Thao tác: Đăng nhập");
  await expect(chips).toContainText("Thời gian: 01/01/2026 – 31/12/2026");

  // Gỡ một nhãn: chỉ bộ lọc đó mất khỏi URL.
  await chips.getByRole("button", { name: "Bỏ lọc Thao tác: Đăng nhập" }).click();
  await expect(page).not.toHaveURL(/verb=/);
  await expect(page).toHaveURL(/from=2026-01-01/);

  // Bộ lọc phụ nằm trong khung "Bộ lọc khác".
  await page.getByRole("button", { name: /Bộ lọc khác/ }).click();
  await page.getByRole("dialog", { name: "Bộ lọc khác" }).getByLabel("Loại thao tác").selectOption("logout");
  await expect(page).toHaveURL(/verb=logout/);
  await expect(page.getByRole("button", { name: /Bộ lọc khác/ })).toContainText("1");

  await chips.getByRole("button", { name: "Xóa tất cả" }).click();
  await expect(page).not.toHaveURL(/verb=|from=/);
  await expect(chips).toHaveCount(0);
});
