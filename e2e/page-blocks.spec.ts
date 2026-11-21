import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin, webUrl } from "./helpers";

// Ảnh PNG 1×1 hợp lệ để thử ảnh minh họa của phần đầu trang.
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const created: { pageId?: string; mediaId?: string } = {};

async function cleanup(request: APIRequestContext, origin: string) {
  if (created.pageId) {
    const current = await (await request.get(`/api/v1/admin/pages/${created.pageId}`)).json() as { page?: Record<string, unknown> & { draftVersion: number } };
    if (current.page) {
      const { id, draftVersion, publishedAt, updatedAt, ...values } = current.page;
      void publishedAt; void updatedAt;
      const archived = await (await request.post("/api/v1/admin/pages", { headers: { origin }, data: { id, values: { ...values, status: "archived" }, expectedVersion: draftVersion } })).json() as { page?: { draftVersion: number } };
      await request.delete(`/api/v1/admin/pages/${id}`, { headers: { origin }, data: { expectedVersion: archived.page?.draftVersion ?? draftVersion + 1 } });
    }
    created.pageId = undefined;
  }
  if (created.mediaId) { await request.delete(`/api/v1/admin/media/${created.mediaId}`, { headers: { origin } }); created.mediaId = undefined; }
}

test.afterEach(async ({ page, baseURL }) => { await cleanup(page.request, baseURL!); });

test("Các khối trang hiển thị có bố cục: phần đầu có ảnh và nút, số liệu, quy trình đánh số, FAQ mở/đóng, kêu gọi hành động", async ({ page }) => {
  await loginAsAdmin(page);
  const origin = new URL(page.url()).origin;
  const stamp = Date.now();
  const upload = await page.request.post("/api/v1/admin/media", { headers: { origin }, multipart: { file: { name: `e2e-hero-${stamp}.png`, mimeType: "image/png", buffer: tinyPng } } });
  expect(upload.ok()).toBe(true);
  created.mediaId = ((await upload.json()) as { asset: { id: string } }).asset.id;

  const slug = `e2e-khoi-trang-${stamp}`;
  const blocks = [
    { type: "hero", isEnabled: true, data: { eyebrow: "Nền tảng vận hành", title: "Đơn giản hóa vận hành", description: "Mô tả ngắn cho phần đầu trang.", primaryAction: { label: "Nhận tư vấn", href: "/lien-he" }, secondaryAction: { label: "Xem phần mềm", href: "/phan-mem" }, mediaId: created.mediaId } },
    { type: "stats", isEnabled: true, data: { eyebrow: "Con số", title: "iOrder trong số liệu", items: [{ value: "5.000+", label: "Cửa hàng", note: null }, { value: "63", label: "Tỉnh thành", note: "Toàn quốc" }, { value: "24/7", label: "Hỗ trợ", note: null }] } },
    { type: "features", isEnabled: true, data: { eyebrow: "Hệ sinh thái", title: "Công nghệ phục vụ công việc", description: null, items: [{ title: "Phần mềm", description: "Bán hàng, kho, báo cáo.", href: "/phan-mem" }, { title: "Thiết bị", description: "Máy POS, máy in.", href: "/thiet-bi" }, { title: "Dịch vụ", description: "Triển khai, đào tạo.", href: null }] } },
    { type: "process", isEnabled: true, data: { eyebrow: "Triển khai", title: "Bốn bước bắt đầu", description: null, items: [{ title: "Khảo sát", description: "Tìm hiểu mô hình.", href: null }, { title: "Cài đặt", description: "Cài phần mềm, thiết bị.", href: null }, { title: "Đào tạo", description: "Hướng dẫn nhân viên.", href: null }, { title: "Đồng hành", description: "Hỗ trợ sau triển khai.", href: null }] } },
    { type: "faq", isEnabled: true, data: { eyebrow: null, title: "Câu hỏi thường gặp", items: [{ question: "Có dùng thử không?", answer: "Có, 14 ngày miễn phí." }, { question: "Mất mạng có bán được không?", answer: "Vẫn bán được, dữ liệu đồng bộ lại khi có mạng." }] } },
    { type: "cta", isEnabled: true, data: { id: "tu-van", eyebrow: "Bắt đầu", title: "Cùng iOrder thiết kế cách vận hành", action: { label: "Trao đổi với chuyên gia", href: "/lien-he" } } },
  ];
  const save = await page.request.post("/api/v1/admin/pages", { headers: { origin }, data: { id: null, values: { title: "Kiểm tra khối trang", slug, template: "default", status: "published", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null, blocks } } });
  expect(save.status()).toBe(201);
  created.pageId = ((await save.json()) as { page: { id: string } }).page.id;

  const site = await page.context().newPage();
  await site.setViewportSize({ width: 1280, height: 900 });
  await site.goto(`${webUrl}/trang/${slug}`);
  await expect(site.locator("h1")).toHaveText("Đơn giản hóa vận hành");
  await expect(site.getByRole("link", { name: "Nhận tư vấn" })).toHaveClass(/button--primary/);
  await expect(site.locator("section").first().locator("img")).toHaveAttribute("src", /media/);
  await expect(site.getByText("5.000+")).toBeVisible();
  await expect(site.getByRole("link", { name: /Phần mềm/ }).filter({ hasText: "Xem thêm" })).toHaveAttribute("href", "/phan-mem");
  await expect(site.locator("ol > li")).toHaveCount(4);
  const answer = site.getByText("Có, 14 ngày miễn phí.");
  await expect(answer).toBeHidden();
  await site.getByText("Có dùng thử không?").click();
  await expect(answer).toBeVisible();
  await expect(site.locator("#tu-van").getByRole("link", { name: "Trao đổi với chuyên gia" })).toBeVisible();
  await site.screenshot({ path: "test-results/page-blocks-desktop.png", fullPage: true });
  await site.setViewportSize({ width: 390, height: 844 });
  await site.screenshot({ path: "test-results/page-blocks-mobile.png", fullPage: true });
  await site.close();
});

test("Danh sách khối: nhãn giao diện trên dòng gập, Nhân bản chèn bản sao ngay dưới (không lưu)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsAdmin(page);
  await page.goto("/admin/homepage");
  const blocks = page.locator(".admin-block");
  await expect(blocks.first()).toBeVisible();
  const count = await blocks.count();
  test.skip(count < 2, "Trang chủ cần ít nhất hai khối");
  // Phần đầu trang không nhân bản được (mỗi trang một phần đầu trang).
  const detail = page.getByRole("region", { name: "Chỉnh sửa thành phần" });
  await blocks.first().locator(".admin-block__toggle").click();
  await expect(detail.getByRole("button", { name: /^Nhân bản/ })).toBeDisabled();
  const source = blocks.nth(1);
  const label = await source.locator(".admin-block__toggle > strong").textContent();
  await source.locator(".admin-block__toggle").click();
  await detail.getByRole("button", { name: /^Nhân bản/ }).click();
  await expect(blocks).toHaveCount(count + 1);
  await expect(blocks.nth(2)).toHaveClass(/admin-block--open/);
  await expect(blocks.nth(2).locator(".admin-block__toggle > strong")).toHaveText(label!);
  // Bản sao bỏ mã neo để neo trên trang không trùng.
  await expect(blocks.nth(2).locator(".admin-block__tag", { hasText: /^#/ })).toHaveCount(0);
  await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
});
