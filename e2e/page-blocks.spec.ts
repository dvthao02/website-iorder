import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin, webUrl } from "./helpers";

// Ảnh PNG 1×1 hợp lệ để thử ảnh minh họa của phần đầu trang.
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const created: { pageId?: string; mediaId?: string } = {};

async function cleanup(request: APIRequestContext, origin: string) {
  if (created.pageId) {
    const current = await (await request.get(`/api/admin/pages/${created.pageId}`)).json() as { page?: Record<string, unknown> & { draftVersion: number } };
    if (current.page) {
      const { id, draftVersion, publishedAt, updatedAt, ...values } = current.page;
      void publishedAt; void updatedAt;
      const archived = await (await request.post("/api/admin/pages", { headers: { origin }, data: { id, values: { ...values, status: "archived" }, expectedVersion: draftVersion } })).json() as { page?: { draftVersion: number } };
      await request.delete(`/api/admin/pages/${id}`, { headers: { origin }, data: { expectedVersion: archived.page?.draftVersion ?? draftVersion + 1 } });
    }
    created.pageId = undefined;
  }
  if (created.mediaId) { await request.delete(`/api/admin/media/${created.mediaId}`, { headers: { origin } }); created.mediaId = undefined; }
}

test.afterEach(async ({ page, baseURL }) => { await cleanup(page.request, baseURL!); });

test("Các khối trang hiển thị có bố cục: phần đầu có ảnh và nút, số liệu, quy trình đánh số, FAQ mở/đóng, kêu gọi hành động", async ({ page }) => {
  await loginAsAdmin(page);
  const origin = new URL(page.url()).origin;
  const stamp = Date.now();
  const upload = await page.request.post("/api/admin/media", { headers: { origin }, multipart: { file: { name: `e2e-hero-${stamp}.png`, mimeType: "image/png", buffer: tinyPng } } });
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
  const save = await page.request.post("/api/admin/pages", { headers: { origin }, data: { id: null, values: { title: "Kiểm tra khối trang", slug, template: "default", status: "published", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null, blocks } } });
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

test("Trình sửa trang chỉ có một thanh cuộn; trường ảnh của phần đầu trang không lồng khung", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  const pages = await (await page.request.get("/api/admin/pages?query=home&pageSize=25")).json() as { result: { items: Array<{ id: string; slug: string }> } };
  const home = pages.result.items.find((item) => item.slug === "home");
  test.skip(!home, "Cần trang chủ có sẵn khối");
  await page.goto(`/admin/pages/${home!.id}`);
  const hero = page.locator(".admin-block").filter({ has: page.locator(".admin-block__toggle > strong", { hasText: "Phần đầu trang" }) }).first();
  if (!(await hero.evaluate((element) => element.classList.contains("admin-block--open")))) await hero.locator(".admin-block__toggle").click();
  const picker = hero.locator(".media-picker");
  await expect(picker.getByRole("heading", { name: "Ảnh minh họa (tùy chọn)" })).toBeVisible();
  // Bộ chọn ảnh nằm trực tiếp trong khối, không bọc thêm khung nhóm.
  expect(await picker.evaluate((element) => element.closest(".admin-block-group") === null)).toBe(true);
  await hero.screenshot({ path: "test-results/page-editor-hero.png" });

  // Chỉ phần thân cuộn, nằm gọn giữa thanh tiêu đề và thanh lưu (thanh cuộn không chui dưới hai thanh).
  const body = page.locator(".admin-editor-detail-page .admin-detail-panel__body");
  await body.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  const layout = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const main = document.querySelector(".admin-shell__main")!;
    const scroller = document.querySelector(".admin-editor-detail-page .admin-detail-panel__body")!;
    return {
      document: document.scrollingElement!.scrollHeight, viewport: innerHeight,
      mainScrolls: main.scrollHeight > main.clientHeight, bodyScrolls: scroller.scrollHeight > scroller.clientHeight,
      header: rect(".admin-detail-panel__header").bottom, actions: rect(".admin-editor-actions--fixed").top, body: rect(".admin-editor-detail-page .admin-detail-panel__body"),
    };
  });
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.mainScrolls).toBe(false);
  expect(layout.bodyScrolls).toBe(true);
  expect(layout.body.top).toBeGreaterThanOrEqual(layout.header - 1);
  expect(layout.body.bottom).toBeLessThanOrEqual(layout.actions + 1);
  await page.screenshot({ path: "test-results/page-editor-scroll.png" });
});

test("Cuộn bài dài: thanh công cụ soạn thảo dính sát dưới thanh tiêu đề, không để lộ khe", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  await page.goto("/admin/tin-tuc/moi");
  await page.locator(".admin-rte__content .tiptap").click();
  for (let index = 0; index < 40; index++) await page.keyboard.press("Enter");
  await page.locator(".admin-detail-panel__body").evaluate((element) => element.scrollTo(0, 900));
  const position = await page.evaluate(() => ({
    toolbar: document.querySelector(".admin-rte__toolbar")!.getBoundingClientRect().top,
    header: document.querySelector(".admin-detail-panel__header")!.getBoundingClientRect().bottom,
  }));
  expect(Math.abs(position.toolbar - position.header)).toBeLessThanOrEqual(1);
});
