import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin, webUrl } from "./helpers";
import { makeDocx } from "./fixtures/make-docx";

const created: { posts: string[]; mediaNames: string[] } = { posts: [], mediaNames: [] };

async function cleanup(request: APIRequestContext, origin: string) {
  for (const id of created.posts.splice(0)) {
    const current = await (await request.get(`/api/admin/posts/${id}`)).json() as { post?: { status: string; draftVersion: number } };
    if (!current.post) continue;
    let version = current.post.draftVersion;
    if (current.post.status !== "archived") version = ((await (await request.patch(`/api/admin/posts/${id}`, { headers: { origin }, data: { action: "archive", expectedVersion: version } })).json()) as { post?: { draftVersion: number } }).post?.draftVersion ?? version + 1;
    await request.delete(`/api/admin/posts/${id}`, { headers: { origin }, data: { expectedVersion: version } });
  }
  // Ảnh do bước nhập file tải lên.
  for (const name of created.mediaNames.splice(0)) {
    const list = await (await request.get(`/api/admin/media?query=${encodeURIComponent(name)}`)).json() as { assets: Array<{ id: string; originalName: string }> };
    for (const asset of list.assets.filter((item) => item.originalName.startsWith(name))) await request.delete(`/api/admin/media/${asset.id}`, { headers: { origin } });
  }
}

test.afterEach(async ({ page, baseURL }) => { await cleanup(page.request, baseURL!); });

test("Soạn bài kiểu Word: nhập file .docx, xuất bản, website có mục lục và định dạng", async ({ page }) => {
  await loginAsAdmin(page);
  const stamp = Date.now();
  const title = `Tiêu đề từ Word ${stamp}`;
  await page.goto("/admin/tin-tuc/moi");
  await expect(page.getByRole("toolbar", { name: "Định dạng nội dung" })).toBeVisible();

  created.mediaNames.push("anh-nhap-");
  await page.locator('input[type="file"][accept*=".docx"]').setInputFiles({ name: `bai-${stamp}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: makeDocx(title, [["Phần một", "Nội dung phần một."], ["Phần hai", "Nội dung phần hai."]]) });
  await expect(page.locator(".admin-toast").filter({ hasText: "Đã nhập nội dung từ file." })).toBeVisible();
  // Tiêu đề H1 trong file thành tiêu đề bài; đường dẫn tự tạo theo tiêu đề.
  await expect(page.getByLabel("Tiêu đề", { exact: true })).toHaveValue(title);
  const editor = page.locator(".admin-rte__content .tiptap");
  await expect(editor.locator("h2")).toHaveText(["Phần một", "Phần hai"]);
  await expect(editor.locator("table td")).toHaveCount(4);
  await expect(editor.locator("img")).toHaveAttribute("src", /^\/media\//);

  // Định dạng thêm bằng thanh công cụ: in nghiêng một đoạn mới.
  await editor.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "In nghiêng (Ctrl+I)" }).click();
  await page.keyboard.type("Ghi chú in nghiêng");
  await expect(editor.locator("em")).toHaveText("Ghi chú in nghiêng");

  // Thiết lập xuất bản nằm ở cột phải; nút lưu nói rõ hành động.
  await page.getByRole("radio", { name: /^Đăng ngay/ }).check();
  await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: /Đã/ }).first()).toBeVisible();
  const slug = `tieu-de-tu-word-${stamp}`;
  const search = await (await page.request.get(`/api/admin/posts?query=${slug}&view=summary`)).json() as { result: { items: Array<{ id: string; slug: string }> } };
  const post = search.result.items.find((item) => item.slug === slug);
  expect(post).toBeTruthy();
  created.posts.push(post!.id);

  const site = await page.context().newPage();
  await site.goto(`${webUrl}/tin-tuc/${slug}`);
  const toc = site.getByRole("navigation", { name: "Mục lục bài viết" });
  await expect(toc.getByRole("link")).toHaveText(["Phần một", "Phần hai"]);
  await expect(toc.getByRole("link", { name: "Phần hai" })).toHaveAttribute("href", "#phan-hai");
  await expect(site.locator("h2#phan-mot")).toHaveText("Phần một");
  await expect(site.locator("article strong").first()).toHaveText("Điểm nhấn in đậm");
  await expect(site.locator("article em")).toHaveText("Ghi chú in nghiêng");
  await expect(site.locator("article table td")).toHaveCount(4);
  await expect(site.locator("article ul > li")).toHaveCount(2);
  await site.screenshot({ path: "test-results/rich-post.png", fullPage: true });
  await site.close();
});

test("Máy chủ từ chối nội dung có liên kết javascript: hoặc ảnh ngoài thư viện", async ({ page }) => {
  await loginAsAdmin(page);
  const origin = new URL(page.url()).origin;
  const base = { type: "news", title: "Kiểm tra làm sạch", slug: `e2e-lam-sach-${Date.now()}`, excerpt: null, status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null, promotionStartAt: null, promotionEndAt: null, ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null, categoryIds: [], tagIds: [] };
  for (const doc of [
    { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] },
    { type: "doc", content: [{ type: "image", attrs: { src: "https://evil.example/a.png" } }] },
  ]) {
    const response = await page.request.post("/api/admin/posts", { headers: { origin }, data: { ...base, content: { version: 2, doc } } });
    expect(response.status()).toBe(400);
  }
});

test("Rời trang khi chưa lưu: hỏi bằng hộp của CMS (không dùng hộp của trình duyệt); menu Mẫu bài hiển thị gọn", async ({ page }) => {
  let nativeDialog = false;
  page.on("dialog", async (dialog) => { nativeDialog = true; await dialog.dismiss(); });
  await loginAsAdmin(page);
  await page.goto("/admin/tin-tuc/moi");
  await page.getByLabel("Tiêu đề", { exact: true }).fill("Bản nháp chưa lưu");

  // Menu Mẫu bài: các mục không chồng lên nhau.
  await page.getByText("Mẫu bài", { exact: true }).click();
  const items = page.locator(".admin-rte__menu-item");
  await expect(items).toHaveCount(4);
  const [first, second] = [await items.nth(0).boundingBox(), await items.nth(1).boundingBox()];
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height - 1);
  await page.keyboard.press("Escape");

  const sidebarLink = page.getByRole("link", { name: "Trang website" }).first();
  await sidebarLink.click();
  const dialog = page.getByRole("alertdialog", { name: "Rời màn hình khi chưa lưu?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Ở lại" }).click();
  await expect(page).toHaveURL(/\/admin\/tin-tuc\/moi$/);
  await expect(page.getByLabel("Tiêu đề", { exact: true })).toHaveValue("Bản nháp chưa lưu");

  await sidebarLink.click();
  await dialog.getByRole("button", { name: "Rời trang" }).click();
  await expect(page).toHaveURL(/\/admin\/pages/);
  expect(nativeDialog).toBe(false);
});

test("Ảnh trong bài: đổi kích thước, căn trái cho chữ chạy quanh; khối ảnh nền có chữ đè lên ảnh", async ({ page }) => {
  await loginAsAdmin(page);
  const stamp = Date.now();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.goto("/admin/tin-tuc/moi");
  await page.getByLabel("Tiêu đề", { exact: true }).fill(`Ảnh nền ${stamp}`);
  const editor = page.locator(".admin-rte__content .tiptap");
  await editor.click();
  await page.keyboard.type("Đoạn mở đầu của bài viết có ảnh nhỏ bên cạnh.");

  const imageInputs = page.locator('.admin-rte input[type="file"][accept^="image/"]');
  created.mediaNames.push(`e2e-anh-${stamp}`, `e2e-nen-${stamp}`);
  await imageInputs.nth(0).setInputFiles({ name: `e2e-anh-${stamp}.png`, mimeType: "image/png", buffer: png });
  // Như Word: rê chuột vào ảnh hiện thanh ngắt dòng và tay nắm; kéo góc để thu nhỏ.
  const frame = editor.locator(".admin-rte-image");
  await frame.hover();
  await frame.getByRole("button", { name: "Chữ bao quanh, ảnh bên trái" }).click();
  await expect(frame).toHaveAttribute("data-align", "left");
  await expect(frame).toHaveAttribute("data-width", "50");
  const handle = frame.locator(".admin-rte-image__handle--ne");
  const box = (await handle.boundingBox())!;
  const contentWidth = (await editor.boundingBox())!.width;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - contentWidth * 0.1, box.y, { steps: 5 });
  await expect(frame.locator(".admin-rte-image__size")).toHaveText(/^(3[6-9]|4[0-4])%$/);
  await page.mouse.up();
  const dragged = Number(await frame.getAttribute("data-width"));
  expect(dragged).toBeGreaterThanOrEqual(36);
  expect(dragged).toBeLessThanOrEqual(44);

  await frame.click();
  await page.locator(".admin-rte").screenshot({ path: "test-results/rte-image-hover.png" });
  const imageBar = page.getByRole("group", { name: "Tùy chỉnh ảnh" });
  await imageBar.getByLabel("Mô tả ảnh").fill("Ảnh minh họa");
  await expect(editor.locator("img")).toHaveAttribute("alt", "Ảnh minh họa");

  // Khối ảnh nền chèn ở cuối bài, có sẵn tiêu đề và đoạn văn đè lên ảnh.
  await editor.locator("p").first().click();
  await page.keyboard.press("Control+End");
  await imageInputs.nth(1).setInputFiles({ name: `e2e-nen-${stamp}.png`, mimeType: "image/png", buffer: png });
  const banner = editor.locator(".admin-rte-banner");
  await expect(banner.locator("h2")).toHaveText("Tiêu đề trên ảnh");
  await banner.locator("p").click();
  const bannerBar = page.getByRole("group", { name: "Tùy chỉnh khối ảnh nền" });
  await bannerBar.getByRole("button", { name: "Sáng", exact: true }).click();
  await bannerBar.getByRole("button", { name: "Cao", exact: true }).click();
  await expect(banner).toHaveAttribute("data-overlay", "light");
  await expect(banner).toHaveAttribute("data-height", "tall");
  await expect(banner).toHaveAttribute("style", /\/media\//);

  // Thiết lập xuất bản nằm ở cột phải; nút lưu nói rõ hành động.
  await page.getByRole("radio", { name: /^Đăng ngay/ }).check();
  await page.getByRole("button", { name: "Xuất bản", exact: true }).click();
  await expect(page.locator(".admin-toast").filter({ hasText: /Đã/ }).first()).toBeVisible();
  const slug = `anh-nen-${stamp}`;
  const search = await (await page.request.get(`/api/admin/posts?query=${slug}&view=summary`)).json() as { result: { items: Array<{ id: string; slug: string }> } };
  const post = search.result.items.find((item) => item.slug === slug);
  expect(post).toBeTruthy();
  created.posts.push(post!.id);

  const site = await page.context().newPage();
  await site.setViewportSize({ width: 1280, height: 900 });
  await site.goto(`${webUrl}/tin-tuc/${slug}`);
  const figure = site.locator("article figure").filter({ has: site.getByAltText("Ảnh minh họa") });
  await expect(figure).toHaveCSS("float", "left");
  // Độ rộng trên website khớp % đã kéo trong CMS.
  const ratio = (await figure.boundingBox())!.width / (await site.locator("article").locator("div.flow-root").boundingBox())!.width;
  expect(Math.abs(ratio * 100 - dragged)).toBeLessThan(2);
  const siteBanner = site.locator("article section").filter({ hasText: "Tiêu đề trên ảnh" });
  await expect(siteBanner.locator("h2")).toHaveText("Tiêu đề trên ảnh");
  await expect(siteBanner.locator("img")).toHaveAttribute("src", /media/);
  expect((await siteBanner.boundingBox())!.height).toBeGreaterThanOrEqual(400);
  await site.screenshot({ path: "test-results/rich-image-banner.png", fullPage: true });
  await site.close();
});
