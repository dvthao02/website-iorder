import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin, webUrl } from "./helpers";

// Thư viện "Thêm thành phần" (chia nhóm, có hình, tìm được) và hai khối mới: Ảnh + chữ, Bảng giá.
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

test("Ảnh + chữ xen kẽ và Bảng giá hiển thị trên website; thư viện thành phần thêm được Bảng giá", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsAdmin(page);
  const origin = new URL(page.url()).origin;
  const stamp = Date.now();
  const upload = await page.request.post("/api/v1/admin/media", { headers: { origin }, multipart: { file: { name: `e2e-section-${stamp}.png`, mimeType: "image/png", buffer: tinyPng } } });
  created.mediaId = ((await upload.json()) as { asset: { id: string } }).asset.id;

  const slug = `e2e-section-${stamp}`;
  const mediaText = (layout: string, title: string) => ({ type: "media_text", isEnabled: true, data: { layout, tone: layout === "image_left" ? "tinted" : "light", eyebrow: "Báo cáo", title, description: "Theo dõi doanh thu mọi lúc.", bullets: ["Báo cáo theo ca", "Xuất Excel"], mediaId: created.mediaId, primaryAction: { label: "Dùng thử", href: "/lien-he" }, secondaryAction: null } });
  const pricing = { type: "pricing", isEnabled: true, data: { eyebrow: null, title: "Bảng giá", description: "Chọn gói phù hợp.", note: "Giá chưa gồm VAT", plans: [
    { name: "Cơ bản", price: "199.000đ", period: "/tháng", description: null, features: ["1 cửa hàng"], action: { label: "Đăng ký", href: "/lien-he" }, highlighted: false, badge: null },
    { name: "Chuyên nghiệp", price: "399.000đ", period: "/tháng", description: null, features: ["3 cửa hàng", "Báo cáo nâng cao"], action: { label: "Đăng ký", href: "/lien-he" }, highlighted: true, badge: "Phổ biến" },
    { name: "Doanh nghiệp", price: "Liên hệ", period: null, description: null, features: ["Không giới hạn"], action: { label: "Liên hệ", href: "/lien-he" }, highlighted: false, badge: null },
  ] } };
  const response = await page.request.post("/api/v1/admin/pages", { headers: { origin }, data: { id: null, values: { title: "Thử thành phần", slug, template: "default", status: "published", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null, blocks: [mediaText("image_right", "Báo cáo trực quan"), mediaText("image_left", "Quản lý kho"), pricing] } } });
  expect(response.ok(), await response.text()).toBe(true);
  created.pageId = ((await response.json()) as { page: { id: string } }).page.id;

  const site = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await site.goto(`${webUrl}/trang/${slug}`);
  // Ảnh + chữ: khối 1 ảnh bên phải, khối 2 ảnh bên trái.
  for (const [title, imageRight] of [["Báo cáo trực quan", true], ["Quản lý kho", false]] as const) {
    const section = site.locator("section").filter({ has: site.getByRole("heading", { name: title }) });
    const [heading, image] = [await section.getByRole("heading", { name: title }).boundingBox(), await section.locator("img").boundingBox()];
    expect(imageRight ? image!.x > heading!.x : image!.x < heading!.x).toBe(true);
    await expect(section.getByText("Xuất Excel")).toBeVisible();
  }
  // Bảng giá: 3 gói, gói nổi bật có nhãn và nút chính.
  const plans = site.locator("article").filter({ has: site.locator("h3") });
  await expect(plans).toHaveCount(3);
  const featured = plans.filter({ hasText: "Chuyên nghiệp" });
  await expect(featured.getByText("Phổ biến")).toBeVisible();
  await expect(featured.getByRole("link", { name: "Đăng ký" })).toHaveClass(/button--primary/);
  await expect(plans.filter({ hasText: "Cơ bản" }).getByRole("link", { name: "Đăng ký" })).toHaveClass(/button--secondary/);
  await site.getByRole("heading", { name: "Bảng giá" }).scrollIntoViewIfNeeded();
  await site.screenshot({ fullPage: true, path: "test-results/section-blocks-site.png" });
  await site.close();

  // CMS: thư viện chia nhóm, tìm "giá" ra Bảng giá; chọn thì khối được thêm và mở sẵn.
  await page.goto(`/admin/pages/${created.pageId}`);
  await page.getByRole("button", { name: "Thêm thành phần" }).click();
  const library = page.getByRole("dialog", { name: "Thêm thành phần" });
  await expect(library.getByRole("region", { name: "Giới thiệu" })).toBeVisible();
  await expect(library.getByRole("button", { name: /Phần đầu trang/ })).toBeEnabled();
  await page.screenshot({ path: "test-results/section-blocks-library.png" });
  await library.getByRole("searchbox", { name: "Tìm thành phần" }).fill("giá");
  await expect(library.getByRole("button", { name: /Ảnh \+ chữ/ })).toHaveCount(0);
  await library.getByRole("button", { name: /Bảng giá/ }).click();
  await expect(library).toBeHidden();
  await expect(page.locator(".admin-block").last()).toContainText("Bảng giá");
  await expect(page.getByText("Các gói (1/4)")).toBeVisible();
});
