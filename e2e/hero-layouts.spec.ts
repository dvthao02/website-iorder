import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin, webUrl } from "./helpers";

// Phần đầu trang có 5 kiểu bố cục chọn trong CMS; website vẽ đúng kiểu. Mỗi kiểu một trang thử riêng
// (slug riêng nên không dính cache), xong thì lưu trữ + xóa trang và ảnh.
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const created: { pageIds: string[]; mediaIds: string[] } = { pageIds: [], mediaIds: [] };

async function cleanup(request: APIRequestContext, origin: string) {
  for (const id of created.pageIds.splice(0)) {
    const current = await (await request.get(`/api/admin/pages/${id}`)).json() as { page?: Record<string, unknown> & { draftVersion: number } };
    if (!current.page) continue;
    const { draftVersion, publishedAt, updatedAt, ...values } = current.page;
    void publishedAt; void updatedAt; Reflect.deleteProperty(values, "id");
    const archived = await (await request.post("/api/admin/pages", { headers: { origin }, data: { id, values: { ...values, status: "archived" }, expectedVersion: draftVersion } })).json() as { page?: { draftVersion: number } };
    await request.delete(`/api/admin/pages/${id}`, { headers: { origin }, data: { expectedVersion: archived.page?.draftVersion ?? draftVersion + 1 } });
  }
  for (const id of created.mediaIds.splice(0)) await request.delete(`/api/admin/media/${id}`, { headers: { origin } });
}

test.afterEach(async ({ page, baseURL }) => { await cleanup(page.request, baseURL!); });

async function uploadImage(request: APIRequestContext, origin: string, name: string) {
  const upload = await request.post("/api/admin/media", { headers: { origin }, multipart: { file: { name, mimeType: "image/png", buffer: tinyPng } } });
  expect(upload.ok()).toBe(true);
  const id = ((await upload.json()) as { asset: { id: string } }).asset.id;
  created.mediaIds.push(id);
  return id;
}

async function createPage(request: APIRequestContext, origin: string, slug: string, hero: Record<string, unknown>) {
  const data = { eyebrow: "Giải pháp quản lý bán hàng toàn diện", title: `Phần mềm quản lý hiệu quả ${slug}`, description: "Quản lý bán hàng, kho, nhân viên và báo cáo trên một nền tảng.", primaryAction: { label: "Dùng thử miễn phí", href: "/lien-he" }, secondaryAction: { label: "Xem demo", href: "/phan-mem" }, highlights: [{ title: "Dễ sử dụng", note: "Bắt đầu nhanh chóng" }, { title: "Triển khai nhanh", note: null }, { title: "Hỗ trợ 24/7", note: "Luôn đồng hành" }], footnote: "Dùng thử miễn phí 15 ngày", slides: [], extraMediaIds: [], tone: null, panels: [], ...hero };
  const response = await request.post("/api/admin/pages", { headers: { origin }, data: { id: null, values: { title: "Thử phần đầu trang", slug, template: "default", status: "published", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null, blocks: [{ type: "hero", isEnabled: true, data }] } } });
  expect(response.ok(), await response.text()).toBe(true);
  created.pageIds.push(((await response.json()) as { page: { id: string } }).page.id);
  return data.title as string;
}

test("Phần đầu trang: 5 kiểu bố cục hiển thị đúng trên website", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsAdmin(page);
  const origin = new URL(page.url()).origin;
  const stamp = Date.now();
  const imageId = await uploadImage(page.request, origin, `e2e-hero-${stamp}.png`);
  const site = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Chữ trái, ảnh phải (mặc định) và đảo chiều.
  for (const layout of ["split", "split_reverse"] as const) {
    const slug = `e2e-hero-${layout.replace("_", "-")}-${stamp}`;
    const title = await createPage(page.request, origin, slug, { layout, mediaId: imageId });
    await site.goto(`${webUrl}/trang/${slug}`);
    const heading = site.getByRole("heading", { level: 1, name: title });
    await expect(heading).toBeVisible();
    const image = site.locator("section").first().locator("img");
    const [textBox, imageBox] = [await heading.boundingBox(), await image.boundingBox()];
    expect(layout === "split" ? imageBox!.x > textBox!.x : imageBox!.x < textBox!.x).toBe(true);
    await expect(site.getByText("Triển khai nhanh")).toBeVisible();
    await expect(site.getByText("Dùng thử miễn phí 15 ngày")).toBeVisible();
    await site.screenshot({ path: `test-results/hero-${layout}.png` });
  }

  // Ảnh nền tràn màn hình: mặc định lớp phủ xanh nhạt, chữ đậm; chọn "Tối" thì chữ trắng.
  const backgroundSlug = `e2e-hero-background-${stamp}`;
  const backgroundTitle = await createPage(page.request, origin, backgroundSlug, { layout: "background", mediaId: imageId });
  await site.goto(`${webUrl}/trang/${backgroundSlug}`);
  const backgroundHeading = site.getByRole("heading", { level: 1, name: backgroundTitle });
  await expect(backgroundHeading).toHaveCSS("color", "rgb(13, 27, 51)");
  expect((await site.locator("section").first().boundingBox())!.width).toBeGreaterThan(1400);
  await site.screenshot({ path: "test-results/hero-background.png" });
  const darkSlug = `e2e-hero-background-dark-${stamp}`;
  const darkTitle = await createPage(page.request, origin, darkSlug, { layout: "background", mediaId: imageId, tone: "dark" });
  await site.goto(`${webUrl}/trang/${darkSlug}`);
  await expect(site.getByRole("heading", { level: 1, name: darkTitle })).toHaveCSS("color", "rgb(255, 255, 255)");

  // Chữ ở giữa.
  const centeredSlug = `e2e-hero-centered-${stamp}`;
  const centeredTitle = await createPage(page.request, origin, centeredSlug, { layout: "centered", mediaId: null });
  await site.goto(`${webUrl}/trang/${centeredSlug}`);
  await expect(site.getByRole("heading", { level: 1, name: centeredTitle }).locator("..")).toHaveCSS("text-align", "center");
  await site.screenshot({ path: "test-results/hero-centered.png" });

  // Trượt nhiều ảnh: tiêu đề cho Google ẩn, mỗi ảnh có chữ riêng, mũi tên chuyển ảnh.
  const secondImageId = await uploadImage(page.request, origin, `e2e-hero-2-${stamp}.png`);
  const sliderSlug = `e2e-hero-slider-${stamp}`;
  const sliderTitle = await createPage(page.request, origin, sliderSlug, { layout: "slider", mediaId: null, slides: [
    { mediaId: imageId, title: "Sạc sống xanh", description: "Trạm sạc cho mọi khu đô thị.", action: { label: "Tìm hiểu", href: "/lien-he" } },
    { mediaId: secondImageId, title: null, description: null, action: null },
  ] });
  await site.goto(`${webUrl}/trang/${sliderSlug}`);
  await expect(site.getByRole("heading", { level: 1, name: sliderTitle })).toHaveClass(/sr-only/);
  const carousel = site.getByRole("region", { name: "Ảnh nổi bật" });
  await expect(carousel.locator(".hero-slider__slide")).toHaveCount(2);
  await expect(carousel.getByText("Sạc sống xanh")).toBeVisible();
  await site.screenshot({ path: "test-results/hero-slider.png" });
  await carousel.getByRole("button", { name: "Ảnh sau" }).click();
  await expect(carousel.getByRole("button", { name: "Xem ảnh 2" })).toHaveAttribute("aria-current", "true");
  await expect(carousel.getByText("Sạc sống xanh")).toBeHidden();
  await site.close();

  // CMS: chọn kiểu bằng hình minh họa; chọn "Trượt nhiều ảnh" thì hiện phần nhập các ảnh trượt.
  await page.goto(`/admin/pages/${created.pageIds.at(-1)}`);
  const toggle = page.locator(".admin-block__toggle").first();
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  const picker = page.getByRole("group", { name: "Kiểu bố cục" });
  await expect(picker.getByRole("radio")).toHaveCount(5);
  await expect(picker.getByRole("radio", { name: "Trượt nhiều ảnh" })).toBeChecked();
  await expect(page.getByText("Các ảnh trượt (2/8)")).toBeVisible();
  await picker.getByText("Ảnh nền tràn màn hình").click();
  await expect(page.getByText("Các ảnh trượt (2/8)")).toBeHidden();
  await expect(page.getByText("Ảnh nền (1/8)")).toBeVisible();
  await page.screenshot({ path: "test-results/hero-cms-picker.png" });
});

test("Phần đầu trang: nhiều khối nội dung trượt cả chữ và ảnh", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  const origin = new URL(page.url()).origin;
  const stamp = Date.now();
  const [firstImage, secondImage] = [await uploadImage(page.request, origin, `e2e-panel-a-${stamp}.png`), await uploadImage(page.request, origin, `e2e-panel-b-${stamp}.png`)];
  const slug = `e2e-hero-panels-${stamp}`;
  const title = await createPage(page.request, origin, slug, { layout: "split", mediaId: firstImage, panels: [{ eyebrow: "Hóa đơn điện tử", title: "Khối thứ hai trượt cùng ảnh", description: "Mô tả của khối thứ hai.", primaryAction: { label: "Xem hóa đơn", href: "/lien-he" }, secondaryAction: null, mediaId: secondImage }] });

  const site = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await site.goto(`${webUrl}/trang/${slug}`);
  // Chỉ một h1 (khối 1); khối 2 nằm sẵn trong trang nhưng ẩn cho tới khi trượt tới.
  await expect(site.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(site.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const carousel = site.getByRole("region", { name: "Nội dung nổi bật" });
  await expect(carousel.getByText("Khối thứ hai trượt cùng ảnh")).toBeHidden();
  await carousel.getByRole("button", { name: "Khối sau" }).click();
  await expect(carousel.getByText("Khối thứ hai trượt cùng ảnh")).toBeVisible();
  await expect(carousel.getByRole("link", { name: "Xem hóa đơn" })).toBeVisible();
  await expect(carousel.getByRole("heading", { level: 1 })).toBeHidden();
  await site.screenshot({ path: "test-results/hero-panels.png" });
  await site.close();

  // CMS: phần "Các khối nội dung trượt" hiện khối 2 với ô nhập riêng.
  await page.goto(`/admin/pages/${created.pageIds.at(-1)}`);
  const toggle = page.locator(".admin-block__toggle").first();
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  await expect(page.getByText("Các khối nội dung trượt (2/8)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm khối nội dung" })).toBeVisible();
});
