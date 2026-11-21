import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { chromium, expect } from "@playwright/test";
import type postgres from "postgres";
import { removeStoredObject } from "../../packages/shared/src/server/media/storage";
import type { AdminPage, PageInput } from "../../packages/shared/src/server/pages/pages.contract";

const require = createRequire(import.meta.url);
const backend = "http://localhost:3202";
const cms = "http://localhost:3201";
const website = "http://localhost:3200";
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Bản build thật + API thật + PostgreSQL tạm; không thay response bằng fixture. */
export async function auditBuilderHttp(input: { databaseUrl: string; previewSecret: string; cookie: string; actor: string; page: AdminPage; pageValues: PageInput; client: postgres.Sql }) {
  const children: ChildProcess[] = [];
  const uploadedKeys: string[] = [];
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const env = { ...process.env, NODE_ENV: "production", DATABASE_URL: input.databaseUrl, PREVIEW_SECRET: input.previewSecret, BACKEND_URL: backend, PUBLISH_WEB_REVALIDATE_URL: `${website}/api/internal/revalidate`, PUBLISH_WEB_REVALIDATE_SECRET: input.previewSecret, NEXT_TELEMETRY_DISABLED: "1", DATABASE_POOL_MAX: "1" };
  async function start(app: string, port: number, ready: string) {
    // Tránh chiếm cổng hoặc dừng một tiến trình của người dùng.
    const net = await import("node:net");
    await new Promise<void>((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(port, () => server.close(error => error ? reject(error) : resolve())); });
    const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(port)], { cwd: `apps/${app}`, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child);
    child.stdout?.resume();
    let startupError = "";
    child.stderr?.on("data", chunk => { startupError = (startupError + String(chunk)).slice(-3000); });
    for (let i = 0; i < 120; i++) {
      if (child.exitCode !== null) { console.error(startupError.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[đã ẩn kết nối]")); throw new Error(`Ứng dụng kiểm thử ${app} đã dừng.`); }
      try { const response = await fetch(`http://localhost:${port}${ready}`, { signal: AbortSignal.timeout(1000) }); if (response.status < 500) return; } catch { /* Chờ chính tiến trình vừa tạo. */ }
      await wait(500);
    }
    throw new Error(`Ứng dụng kiểm thử ${app} chưa sẵn sàng.`);
  }
  const headers = { "content-type": "application/json", origin: cms, "x-forwarded-host": "localhost:3201", cookie: `iorder_admin_session=${input.cookie}` };
  async function post(path: string, body: unknown, extra?: Record<string, string>) { return fetch(`${backend}${path}`, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) }); }
  let stage = "cấu hình";
  try {
    await input.client`insert into site_settings (key,value) values ('publishing',${input.client.json({ siteUrl: website, defaultTitle: "iOrder", defaultDescription: "Website kiểm thử", defaultOgMediaId: null, allowSearchIndexing: true })})`;
    stage = "khởi động Backend";
    await start("api", 3202, "/api/health");
    stage = "khởi động website";
    await start("website", 3200, "/");
    stage = "khởi động CMS";
    await start("admin", 3201, "/login");
    const cacheBody = JSON.stringify({ tags: ["public-content"] });
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", input.previewSecret).update(`${timestamp}.${cacheBody}`).digest("hex");
    assert.equal((await fetch(`${website}/api/internal/revalidate`, { method: "POST", body: cacheBody, headers: { "content-type": "application/json", "x-iorder-cache-timestamp": timestamp, "x-iorder-cache-signature": signature } })).status, 200);
    stage = "lỗi dữ liệu trang";
    const invalidPage = await post("/api/v1/admin/pages", { id: input.page.id, expectedVersion: input.page.draftVersion, values: { ...input.pageValues, blocks: [{ type: "faq", isEnabled: true, data: { eyebrow: null, title: "", items: [{ question: "Hỏi", answer: "Đáp" }] } }] } });
    assert.equal(invalidPage.status, 400);
    assert.match((await invalidPage.json()).error.message, /Thành phần 1 → Tiêu đề: Không được để trống/);
    stage = "API preview";
    const request = { previewId: randomUUID(), documentId: input.page.id, sequence: 1, parentOrigin: cms, document: { kind: "page", values: { ...input.pageValues, blocks: [{ type: "rich_text", data: { heading: "PREVIEW HTTP CHƯA LƯU", body: "Nội dung từ API thật." }, isEnabled: true }] } } };
    assert.equal((await post("/api/v1/admin/builder-preview", request, { cookie: "" })).status, 401);
    const limitedUser = randomUUID();
    const limitedRole = randomUUID();
    const limitedCookie = randomBytes(32).toString("base64url");
    await input.client`insert into users (id,username,full_name,password_hash) values (${limitedUser},'builder-limited','Tài khoản giới hạn','khong-dung-de-dang-nhap')`;
    await input.client`insert into roles (id,code,name) values (${limitedRole},'builder-limited','Giới hạn')`;
    await input.client`insert into user_roles (user_id,role_id) values (${limitedUser},${limitedRole})`;
    await input.client`insert into sessions (user_id,token_hash,expires_at) values (${limitedUser},${createHash("sha256").update(limitedCookie).digest("base64url")},${new Date(Date.now() + 3600000)})`;
    assert.equal((await post("/api/v1/admin/builder-preview", request, { cookie: `iorder_admin_session=${limitedCookie}` })).status, 403);
    assert.equal((await post("/api/v1/admin/builder-preview", request, { origin: "https://nguon-khac.example" })).status, 403);
    const [referencedMedia] = await input.client`select id from media_assets where storage_key='audit/builder.png'`;
    assert.ok(referencedMedia);
    const mediaDelete = await fetch(`${backend}/api/v1/admin/media/${referencedMedia.id}`, { method: "DELETE", headers });
    assert.equal(mediaDelete.status, 409);
    assert.equal((await mediaDelete.json() as { error: { code: string } }).error.code, "MEDIA_IN_USE");
    const invalidBinding = await post("/api/v1/admin/builder-preview", { ...request, previewId: randomUUID(), document: { ...request.document, values: { ...request.document.values, slug: "home", template: "homepage" } } });
    assert.equal(invalidBinding.status, 400);
    const created = await post("/api/v1/admin/builder-preview", request);
    assert.equal(created.status, 200);
    const preview = await created.json() as { token: string; sequence: number };
    assert.equal(preview.sequence, 1);
    assert.equal((await post("/api/v1/admin/builder-preview", request)).status, 409);
    const descriptor = await fetch(`${backend}/api/v1/public/builder-preview?token=${encodeURIComponent(preview.token)}`);
    assert.equal(descriptor.status, 200);
    assert.match(descriptor.headers.get("cache-control") ?? "", /no-store/);
    assert.equal((await fetch(`${backend}/api/v1/public/builder-preview?token=hong`)).status, 404);
    stage = "render website";
    const live = await fetch(`${website}/cms-preview?token=${encodeURIComponent(preview.token)}`);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get("content-security-policy"), `frame-ancestors ${cms}`);
    assert.match(live.headers.get("x-robots-tag") ?? "", /noindex/);
    const liveHtml = await live.text();
    assert.match(liveHtml, /PREVIEW HTTP CHƯA LƯU/);
    assert.match(liveHtml, /data-builder-block="0"/);
    const publicPath = `/trang/${input.page.slug}`;
    const published = await fetch(`${website}${publicPath}`, { headers: { "x-iorder-builder-preview": preview.token } });
    const html = await published.text();
    assert.equal(published.status, 200);
    assert.ok(!html.includes("PREVIEW HTTP CHƯA LƯU"));
    assert.match(html, /Nội dung đã lưu/);
    assert.equal((html.match(/<meta name="description"/g) ?? []).length, 1);
    assert.equal((html.match(/<link rel="canonical"/g) ?? []).length, 1);
    assert.equal((html.match(/<meta name="robots"/g) ?? []).length, 1);
    assert.match(html, /property="og:title" content="Chia sẻ Facebook"/);
    assert.match(html, /name="twitter:title" content="Chia sẻ X"/);
    assert.match(html, /name="twitter:card" content="summary"/);
    assert.match(html, /index, nofollow/);
    assert.ok(html.includes('"@type":"Service"'));
    assert.ok(!html.includes('"@type":"BreadcrumbList"'));
    for (const path of ["/", "/gioi-thieu", "/lien-he", "/dieu-khoan", "/chinh-sach-bao-mat", "/ho-tro/faq", "/ho-tro/video", "/ho-tro-tu-xa", "/tin-tuc/bai-kiem-thu", "/ho-tro/huong-dan/huong-dan-kiem-thu", "/phan-mem/phan-mem-kiem-thu", "/giai-phap/solution-kiem-thu", "/dich-vu/service-kiem-thu", "/thiet-bi/thiet-bi-kiem-thu"]) {
      const response = await fetch(`${website}${path}`);
      assert.equal(response.status, 200, path);
      const content = await response.text();
      for (const pattern of [/<meta name="description"/g, /<link rel="canonical"/g, /<meta name="robots"/g]) assert.equal((content.match(pattern) ?? []).length, 1, path);
      assert.match(content, /property="og:title" content="Chia sẻ Facebook"/, path);
      assert.match(content, /name="twitter:title" content="Chia sẻ X"/, path);
      assert.ok(content.includes('"@type":"Service"'), path);
      assert.ok(!content.includes('"@type":"BreadcrumbList"'), path);
    }
    assert.equal((await fetch(`${website}/catalog-khong-hop-le/phan-mem-kiem-thu`)).status, 404);
    for (const path of ["/tin-tuc", "/thiet-bi", "/ho-tro/cai-dat", "/ho-tro/huong-dan", "/phan-mem", "/giai-phap", "/dich-vu", "/ho-tro"]) assert.equal((await fetch(`${website}${path}`)).status, 200, path);
    const conflict = await post("/api/v1/admin/pages", { id: input.page.id, values: input.pageValues, expectedVersion: 1 });
    assert.equal(conflict.status, 409);
    const sitemapBefore = await (await fetch(`${website}/sitemap.xml`)).text();
    assert.ok(sitemapBefore.includes(publicPath));
    const updated = await post("/api/v1/admin/pages", { id: input.page.id, values: { ...input.pageValues, seo: { ...input.pageValues.seo, index: false } }, expectedVersion: input.page.draftVersion });
    assert.equal(updated.status, 200);
    let sitemapAfter = "";
    for (let i = 0; i < 20; i++) { sitemapAfter = await (await fetch(`${website}/sitemap.xml`)).text(); if (!sitemapAfter.includes(publicPath)) break; await wait(250); }
    assert.ok(!sitemapAfter.includes(publicPath));
    const moved = await fetch(`${website}/trang/kiem-thu-builder`, { redirect: "manual" });
    assert.equal(moved.status, 301);
    stage = "mở Chromium";
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, hasTouch: true });
    await context.addCookies([{ name: "iorder_admin_session", value: input.cookie, url: cms }]);
    let attemptedLeadSubmissions = 0;
    await context.route("**/api/v1/leads", async route => { attemptedLeadSubmissions++; await route.abort(); });
    const formPreview = await post("/api/v1/admin/builder-preview", { ...request, previewId: randomUUID(), document: { kind: "page", values: { ...input.pageValues, blocks: [{ type: "lead_form", isEnabled: true, data: { title: "Form trong preview", description: null, submitLabel: "Gửi kiểm thử", needOptions: [] } }] } } });
    assert.equal(formPreview.status, 200);
    const formToken = (await formPreview.json() as { token: string }).token;
    const formPage = await context.newPage();
    await formPage.goto(`${website}/cms-preview?token=${encodeURIComponent(formToken)}`, { waitUntil: "networkidle" });
    await formPage.locator('input[name="name"]').fill("Không tạo lead thật");
    await formPage.locator('input[name="phone"]').fill("0900000000");
    await formPage.getByRole("button", { name: "Gửi kiểm thử", exact: true }).click();
    await formPage.locator("form").evaluate(form => (form as HTMLFormElement).requestSubmit());
    await wait(350);
    assert.equal(attemptedLeadSubmissions, 0);
    assert.equal((await input.client`select count(*)::int as total from contact_leads`)[0].total, 0);
    await formPage.close();
    // Build CMS giữ origin local đã cấu hình. Chuyển lưu lượng đó tới bản website kiểm thử,
    // vẫn lấy nguyên response từ ứng dụng thật; không tác động website đang chạy ở cổng 3000.
    await context.route("http://localhost:3000/**", async route => {
      const url = new URL(route.request().url());
      url.port = "3200";
      const response = await route.fetch({ url: url.toString() });
      await route.fulfill({ response });
    });
    await context.route(`${cms}/api/**`, async route => { const url = new URL(route.request().url()); url.port = "3202"; const response = await route.fetch({ url: url.toString(), headers: { ...route.request().headers(), "x-forwarded-host": "localhost:3201" } }); await route.fulfill({ response }); });
    // Rewrites ảnh được chốt lúc build về DB local. Đọc ảnh thật từ Backend schema tạm;
    // không thay dữ liệu bằng fixture và không đánh giá bộ tối ưu ảnh Next ở cổng local.
    await context.route("**/_next/image?**", async route => {
      const mediaUrl = new URL(route.request().url()).searchParams.get("url");
      if (!mediaUrl?.startsWith("/media/")) return route.fallback();
      const response = await route.fetch({ url: backend + mediaUrl });
      await route.fulfill({ response });
    });
    await context.route("**/media/uploads/**", async route => {
      const response = await route.fetch({ url: backend + new URL(route.request().url()).pathname });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    const clientErrors: string[] = [];
    page.on("pageerror", error => clientErrors.push(error.name));
    page.on("dialog", dialog => dialog.accept());
    stage = "builder trong CMS";
    await page.goto(`${cms}/admin/pages/${input.page.id}`, { waitUntil: "domcontentloaded" });
    await page.locator(".admin-blocks--builder").waitFor({ timeout: 30000 });
    const columns = await page.locator(".admin-blocks--builder").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    assert.equal(columns, 2);
    const contentBounds = await page.locator(".admin-blocks__detail").boundingBox();
    const sectionsBounds = await page.locator(".admin-blocks__navigation").boundingBox();
    assert.ok(contentBounds && sectionsBounds && sectionsBounds.x >= contentBounds.x + contentBounds.width, "Danh sách thành phần nằm bên phải vùng nội dung.");
    await page.evaluate(() => Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true }));
    await page.getByRole("button", { name: "Xem trước trang", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Xem trước trang", exact: true });
    await expect(modal).toBeVisible();
    const modalFrame = page.frameLocator('iframe[title="Bản xem trước website"]');
    await modalFrame.locator('[data-builder-block="0"]').waitFor({ timeout: 30000 });
    assert.ok((await page.locator('iframe[title="Bản xem trước website"]').boundingBox())!.width > 1200);
    await modal.getByRole("button", { name: "Điện thoại", exact: true }).click();
    assert.ok((await page.locator('iframe[title="Bản xem trước website"]').boundingBox())!.width <= 390);
    await modal.getByRole("button", { name: "Máy tính", exact: true }).click();
    await page.screenshot({ path: ".next/builder-preview-window.png", fullPage: false });
    await modal.getByRole("button", { name: "Đóng xem trước", exact: true }).click();
    await expect(modal).not.toBeVisible();
    const [iframe] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Cửa sổ riêng ↗", exact: true }).click()]);
    await page.evaluate(() => Reflect.deleteProperty(crypto, "randomUUID"));
    await iframe.locator('[data-builder-block="0"]').waitFor({ timeout: 30000 });
    await page.screenshot({ path: ".next/builder-seo-desktop.png", fullPage: false });
    const body = page.locator('.admin-blocks__detail [contenteditable="true"]').first();
    let failPreviewOnce = true;
    await context.route(`${cms}/api/v1/admin/builder-preview`, async route => { if (failPreviewOnce && route.request().postData()?.includes("THAY ĐỔI TRỰC TIẾP CHƯA LƯU")) { failPreviewOnce = false; await route.abort(); } else await route.fallback(); });
    await body.fill("THAY ĐỔI TRỰC TIẾP CHƯA LƯU");
    const previewControls = page.getByRole("region", { name: "Xem trước trực tiếp", exact: true });
    await expect(previewControls.getByText("Không kết nối được máy chủ xem trước. Bản nhập của bạn vẫn được giữ lại.", { exact: true })).toBeVisible({ timeout: 10000 });
    await previewControls.getByRole("button", { name: "Thử cập nhật xem trước", exact: true }).click();
    await iframe.getByText("THAY ĐỔI TRỰC TIẾP CHƯA LƯU", { exact: true }).waitFor({ timeout: 30000 });
    assert.ok(!(await (await fetch(`${website}${publicPath}`)).text()).includes("THAY ĐỔI TRỰC TIẾP CHƯA LƯU"));
    await iframe.locator('[data-builder-block="0"]').click();
    assert.equal(await page.locator('.admin-block--open').count(), 1);
    stage = "Section và Item";
    const navigation = page.locator(".admin-blocks__navigation");
    const properties = page.locator(".admin-blocks__detail");
    await navigation.locator(".admin-block__toggle").filter({ hasText: "Lưới thẻ" }).click();
    await navigation.getByRole("button", { name: "Thẻ đầu", exact: true }).click();
    await expect(properties.locator('[data-builder-item]:visible')).toHaveCount(1);
    await properties.locator('[data-builder-item]:visible').getByLabel("Tiêu đề", { exact: true }).fill("Thẻ đã sửa");
    await navigation.getByRole("button", { name: "Nhân bản Thẻ đã sửa", exact: true }).click();
    await expect(navigation.locator(".admin-builder-item")).toHaveCount(3);
    await navigation.getByRole("button", { name: "Ẩn Thẻ đã sửa", exact: true }).click();
    await expect(iframe.getByRole("heading", { name: "Thẻ đã sửa", exact: true })).toHaveCount(1, { timeout: 30000 });
    await navigation.getByRole("button", { name: "Hiện Thẻ đã sửa", exact: true }).click();
    await expect(iframe.getByRole("heading", { name: "Thẻ đã sửa", exact: true })).toHaveCount(2, { timeout: 30000 });
    assert.equal(await navigation.getByRole("button", { name: /^Đưa .* (lên|xuống)$/ }).count(), 0);
    assert.equal(await properties.locator(".admin-block__actions").getByRole("button", { name: /^Đưa .* (lên|xuống)$/ }).count(), 0);
    await navigation.locator(".admin-builder-item--selected [data-drag-handle]").press("Alt+ArrowDown");
    await expect(navigation.locator(".admin-builder-item__select").last()).toHaveText("Thẻ đã sửa");
    await expect(navigation.locator(".admin-builder-item--selected [data-drag-handle]")).toBeFocused();
    const dragHandle = navigation.locator(".admin-builder-item").last().locator("[data-drag-handle]");
    await dragHandle.dragTo(navigation.locator(".admin-builder-item").first(), { targetPosition: { x: 50, y: 2 } });
    await expect(navigation.locator(".admin-builder-item").first()).toHaveClass(/admin-builder-item--selected/);
    const touchHandle = await navigation.locator(".admin-builder-item").first().locator("[data-drag-handle]").boundingBox();
    const touchTarget = await navigation.locator(".admin-builder-item").last().boundingBox();
    assert.ok(touchHandle && touchTarget);
    const touchSession = await context.newCDPSession(page);
    const touchX = touchHandle.x + touchHandle.width / 2;
    const touchY = touchHandle.y + touchHandle.height / 2;
    await touchSession.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchX, y: touchY }] });
    for (let step = 1; step <= 5; step++) await touchSession.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touchX, y: touchY + (touchTarget.y + touchTarget.height - 2 - touchY) * step / 5 }] });
    await touchSession.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(navigation.locator(".admin-builder-item").last()).toHaveClass(/admin-builder-item--selected/);
    await touchSession.detach();
    const labels = await navigation.locator(".admin-builder-item__select > span").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left));
    assert.ok(labels.every(left => Math.abs(left - labels[0]) < 1), "Tên các mục con phải cùng một lề trái.");
    await navigation.screenshot({ path: ".next/builder-items-aligned.png" });
    await navigation.getByRole("button", { name: "Xóa Thẻ đã sửa", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Xóa mục", exact: true }).click();
    await expect(navigation.locator(".admin-builder-item")).toHaveCount(2);
    await navigation.getByRole("button", { name: "+ Thêm thẻ", exact: true }).click();
    await properties.locator('[data-builder-item]:visible').getByLabel("Tiêu đề", { exact: true }).fill("Thẻ mới qua builder");
    await expect(iframe.getByRole("heading", { name: "Thẻ mới qua builder", exact: true })).toBeVisible({ timeout: 30000 });
    await properties.getByRole("button", { name: "Nhân bản Lưới thẻ", exact: true }).click();
    await expect(navigation.locator(".admin-block__toggle")).toHaveCount(4);
    await properties.getByRole("button", { name: "Ẩn Lưới thẻ", exact: true }).click();
    await expect(iframe.getByRole("heading", { name: "Các thẻ kiểm thử", exact: true })).toHaveCount(1, { timeout: 30000 });
    await properties.getByRole("button", { name: "Hiện Lưới thẻ", exact: true }).click();
    const selectedSection = navigation.locator(".admin-block--open");
    await selectedSection.locator(".admin-block__head [data-drag-handle]").dragTo(navigation.locator(".admin-block").first(), { targetPosition: { x: 80, y: 2 } });
    await expect(navigation.locator(".admin-block").first()).toHaveClass(/admin-block--open/);
    await properties.getByRole("button", { name: "Xóa Lưới thẻ", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(navigation.locator(".admin-block__toggle")).toHaveCount(3);
    await navigation.locator(".admin-block__toggle").filter({ hasText: "Danh sách theo nhóm" }).click();
    await navigation.getByRole("button", { name: "Mục con đầu", exact: true }).click();
    await properties.getByRole("textbox", { name: "Tên mục 1 của nhóm 1", exact: true }).fill("Mục con đã sửa");
    await expect(iframe.getByText("Mục con đã sửa", { exact: true })).toBeVisible({ timeout: 30000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(350);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: ".next/builder-seo-mobile.png", fullPage: false });
    await page.setViewportSize({ width: 1600, height: 1000 });
    stage = "các thành phần khác";
    const otherBlocks = [
      { type: "pricing", isEnabled: true, data: { eyebrow: null, title: "Giá kiểm thử", description: null, note: null, plans: [{ name: "Gói cơ bản", price: "Liên hệ", period: null, description: null, features: ["Tính năng đầu"], action: null, highlighted: false, badge: null }] } },
      { type: "media_text", isEnabled: true, data: { eyebrow: null, title: "Ảnh chữ kiểm thử", description: null, mediaId: null, bullets: ["Điểm của ảnh chữ"], primaryAction: null, secondaryAction: null } },
      { type: "lead_form", isEnabled: true, data: { title: "Form kiểm thử", description: null, submitLabel: "Gửi", needOptions: ["Nhu cầu đầu"] } },
      { type: "stats", isEnabled: true, data: { eyebrow: null, title: "Số liệu kiểm thử", items: [{ value: "10", label: "Khách hàng", note: null }] } },
      { type: "faq", isEnabled: true, data: { eyebrow: null, title: "Hỏi đáp kiểm thử", items: [{ question: "Câu hỏi đầu", answer: "Câu trả lời" }] } },
      ...["industries", "ecosystem", "process"].map(type => ({ type, isEnabled: true, data: { eyebrow: null, title: type, description: null, items: [{ title: "Thẻ " + type, description: "Mô tả", href: null }] } })),
    ];
    const createdOther = await post("/api/v1/admin/pages", { id: null, values: { ...input.pageValues, slug: "kiem-thu-cac-thanh-phan", blocks: otherBlocks } });
    assert.equal(createdOther.status, 201);
    const otherId = (await createdOther.json()).page.id;
    await page.goto(`${cms}/admin/pages/${otherId}`, { waitUntil: "domcontentloaded" });
    const otherNav = page.locator(".admin-blocks__navigation");
    const otherForm = page.locator(".admin-blocks__detail");
    const edits = [
      { block: 0, path: "plans.0.features", old: "Tính năng đầu", field: "Tính năng gói 1 1", value: "Tính năng đã sửa" },
      { block: 1, path: "bullets", old: "Điểm của ảnh chữ", field: "Dòng 1", value: "Điểm đã sửa" },
      { block: 2, path: "needOptions", old: "Nhu cầu đầu", field: "Nhu cầu 1", value: "Nhu cầu đã sửa" },
      { block: 3, path: "items", old: "Khách hàng", field: "Nhãn", value: "Khách hàng đã sửa" },
      { block: 4, path: "items", old: "Câu hỏi đầu", field: "Câu hỏi", value: "Câu hỏi đã sửa" },
      ...["industries", "ecosystem", "process"].map((type, index) => ({ block: index + 5, path: "items", old: "Thẻ " + type, field: "Tiêu đề", value: "Đã sửa " + type })),
    ];
    for (const edit of edits) {
      await otherNav.locator(".admin-block__toggle").nth(edit.block).click();
      await expect(otherForm.getByRole("tab", { name: "Thông tin chung", exact: true })).toBeVisible();
      await otherNav.locator(`[data-builder-path="${edit.path}"]`).getByRole("button", { name: edit.old, exact: true }).click();
      await expect(otherForm.getByRole("textbox", { name: edit.field, exact: true })).toHaveCount(1);
      await otherForm.getByRole("textbox", { name: edit.field, exact: true }).fill(edit.value);
      await expect(otherForm.getByRole("textbox", { name: edit.field, exact: true })).toBeVisible();
      if (edit.block < 3) assert.equal(await otherNav.getByRole("button", { name: "Ẩn " + edit.value, exact: true }).count(), 0);
    }
    const otherToolbar = await page.locator(".admin-builder-preview").boundingBox();
    const otherEditor = await otherForm.boundingBox();
    assert.ok(otherToolbar && otherEditor && otherEditor.y - otherToolbar.y - otherToolbar.height <= 16, "Cây dài không được tạo khoảng trống phía trên form ngắn.");
    await page.screenshot({ path: ".next/builder-other-components.png", fullPage: false });
    const savedOther = page.waitForResponse(response => response.url().endsWith("/api/v1/admin/pages") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    assert.equal((await savedOther).status(), 200);
    await expect(page.getByText("Đã lưu thay đổi và tạo phiên bản mới.", { exact: true }).first()).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    for (const edit of edits) {
      await otherNav.locator(".admin-block__toggle").nth(edit.block).click();
      await otherNav.locator(`[data-builder-path="${edit.path}"]`).getByRole("button", { name: edit.value, exact: true }).click();
      await expect(otherForm.getByRole("textbox", { name: edit.field, exact: true })).toHaveCount(1);
      await expect(otherForm.getByRole("textbox", { name: edit.field, exact: true })).toHaveValue(edit.value);
    }
    const [storedPlan] = await input.client`select data from page_blocks where page_id=${otherId} and type='pricing'`;
    assert.deepEqual(storedPlan.data.plans[0].features, ["Tính năng đã sửa"]);
    for (const path of ["/admin/homepage", "/admin/products", "/admin/equipment"]) {
      // Các màn danh sách giữ nguyên; trang chủ mở trực tiếp builder dùng chung.
      await page.goto(`${cms}${path}`, { waitUntil: "domcontentloaded" });
      if (path === "/admin/homepage") {
        await expect(page.locator(".admin-blocks--builder")).toBeVisible({ timeout: 30000 });
        const homeProperties = page.locator(".admin-blocks__detail");
        await homeProperties.getByRole("tab", { name: "Bố cục khối", exact: true }).click();
        assert.equal(await homeProperties.getByRole("button", { name: "Thêm mục trượt", exact: true }).count(), 0);
        const slideTree = page.locator(".admin-blocks__navigation");
        await slideTree.getByRole("button", { name: "Mục trượt 1", exact: true }).click();
        await expect(homeProperties.getByLabel("Tiêu đề", { exact: true })).toHaveValue("Phần đầu kiểm thử");
        await expect(slideTree.locator('[data-builder-slide="primary"] [data-builder-path="highlights"]')).toHaveCount(1);
        await slideTree.getByRole("button", { name: "+ Thêm mục trượt", exact: true }).click();
        await page.locator(".admin-blocks__navigation").getByTitle("Khối nội dung mới", { exact: true }).click();
        await expect(homeProperties.getByRole("tab", { name: "Nội dung", exact: true })).toHaveAttribute("aria-selected", "true");
        await homeProperties.locator("[data-builder-item]:visible").getByLabel("Tiêu đề", { exact: true }).fill("Mục trượt đã sửa từ CMS");
        const panelEditor = homeProperties.locator('[data-builder-collection^="Các mục trượt bổ sung"] > [data-builder-item="0"]');
        assert.equal(await panelEditor.locator(":scope > .admin-list-item__head small").count(), 0);
        await expect(panelEditor).toHaveCSS("border-top-style", "dashed");
        const uploadName = `builder-panel-${randomUUID()}.png`;
        const uploaded = page.waitForResponse(response => response.url().endsWith("/api/v1/admin/media") && response.request().method() === "POST");
        await panelEditor.getByLabel("Chọn tệp cho Ảnh của khối", { exact: true }).setInputFiles({ name: uploadName, mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGUlEQVQokWPgajtPEmIY1dA2GkpcwzVpAADVeF8QxfNfZwAAAABJRU5ErkJggg==", "base64") });
        const uploadResponse = await uploaded;
        assert.equal(uploadResponse.status(), 201);
        const { asset: uploadedAsset } = await uploadResponse.json();
        const [storedUpload] = await input.client`select storage_key from media_assets where id=${uploadedAsset.id} and original_name=${uploadName}`;
        assert.ok(storedUpload?.storage_key.startsWith("uploads/"));
        uploadedKeys.push(storedUpload.storage_key);
        assert.equal((await fetch(backend + uploadedAsset.url)).status, 200);
        await expect(panelEditor.getByRole("button", { name: "Xem ảnh", exact: true })).toBeVisible();
        await expect.poll(() => panelEditor.locator(".media-picker__peek img").evaluate(element => { const image = element as HTMLImageElement; return image.complete && image.naturalWidth > 0; })).toBe(true);
        const imageBox = await panelEditor.locator(".media-picker").boundingBox();
        const descriptionBox = await panelEditor.getByLabel("Mô tả", { exact: true }).boundingBox();
        assert.ok(imageBox && descriptionBox && imageBox.y < descriptionBox.y);
        await panelEditor.getByRole("button", { name: "Bỏ ảnh", exact: true }).click();
        await panelEditor.getByRole("button", { name: "Chọn từ thư viện", exact: true }).click();
        await panelEditor.getByRole("option", { name: uploadName, exact: true }).click();
        await expect(panelEditor.getByRole("button", { name: "Xem ảnh", exact: true })).toBeVisible();
        const homeNavigation = page.locator(".admin-blocks__navigation");
        const ownPoints = homeNavigation.locator('[data-builder-path="panels.0.highlights"]');
        await expect(homeNavigation.locator('[data-builder-path="panels"] > details > ol > li').first().locator('[data-builder-path="panels.0.highlights"]')).toHaveCount(1);
        await expect(homeNavigation.getByText("Mục trượt 2", { exact: true })).toBeVisible();
        await ownPoints.getByRole("button", { name: "+ Thêm điểm nổi bật", exact: true }).click();
        await homeProperties.getByLabel("Điểm nổi bật", { exact: true }).filter({ visible: true }).fill("Điểm riêng của mục hai");
        await homeNavigation.getByTitle("Mục trượt đã sửa từ CMS", { exact: true }).click();
        await expect(panelEditor.getByRole("button", { name: "Thêm điểm nổi bật", exact: true })).toBeVisible();
        const common = homeNavigation.locator('[data-builder-path="highlights"]');
        await expect(common.getByRole("button", { name: "+ Thêm điểm nổi bật", exact: true })).toBeVisible();
        await common.getByRole("button", { name: "+ Thêm điểm nổi bật", exact: true }).click();
        await expect(common.locator("details")).toHaveAttribute("open", "");
        await homeProperties.getByLabel("Điểm nổi bật", { exact: true }).filter({ visible: true }).fill("Điểm chung đã thêm");
        await homeNavigation.getByTitle("Mục trượt đã sửa từ CMS", { exact: true }).click();
        await expect(panelEditor.getByLabel("Điểm nổi bật", { exact: true })).toHaveValue("Điểm riêng của mục hai");
        await expect(panelEditor.locator('.admin-list-item').first()).toHaveCSS("border-top-style", "dashed");
        await panelEditor.getByLabel("Tiêu đề", { exact: true }).fill("x".repeat(221));
        await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
        await expect(page.getByText(/Mục trượt bổ sung 1 → Tiêu đề: Vượt giới hạn 220 ký tự/).first()).toBeVisible();
        await panelEditor.getByLabel("Tiêu đề", { exact: true }).fill("Mục trượt đã sửa từ CMS");
        const savedResponse = page.waitForResponse(response => response.url().endsWith("/api/v1/admin/pages") && response.request().method() === "POST");
        await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
        assert.equal((await savedResponse).status(), 200);
        await expect(page.getByText("Đã lưu thay đổi và tạo phiên bản mới.", { exact: true }).first()).toBeVisible({ timeout: 30000 });
        await page.reload({ waitUntil: "domcontentloaded" });
        await homeNavigation.getByTitle("Mục trượt đã sửa từ CMS", { exact: true }).click();
        await expect(panelEditor.getByLabel("Điểm nổi bật", { exact: true })).toHaveValue("Điểm riêng của mục hai");
        await expect(panelEditor.getByRole("button", { name: "Xem ảnh", exact: true })).toBeVisible();
        await page.screenshot({ path: ".next/builder-panel-image-highlights.png", fullPage: false });
        const [savedHome] = await input.client`select b.data from page_blocks b join pages p on p.id=b.page_id where p.slug='home' and b.type='hero' order by b.sort_order limit 1`;
        assert.equal(savedHome.data.panels[0].mediaId, uploadedAsset.id);
        assert.equal(savedHome.data.panels[0].highlights[0].title, "Điểm riêng của mục hai");
        assert.equal(savedHome.data.highlights[0].title, "Điểm chung đã thêm");
        await page.getByRole("button", { name: "Xem trước trang", exact: true }).click();
        const homeFrame = page.frameLocator('iframe[title="Bản xem trước website"]');
        await homeFrame.locator('#hero-tu-cms').waitFor({ timeout: 30000 });
        await expect(homeFrame.locator('#hero-tu-cms')).toHaveCSS("background-color", "rgb(255, 247, 237)");
        assert.equal(await homeFrame.locator('#hero-tu-cms .hero-width').count(), 1);
        await expect(homeFrame.getByText("Mục trượt đã sửa từ CMS", { exact: true })).toHaveCount(1);
        await homeFrame.getByRole("button", { name: "Xem khối 2", exact: true }).click();
        await expect(homeFrame.getByText("Mục trượt đã sửa từ CMS", { exact: true })).toBeVisible();
        await expect(homeFrame.locator(".hero-rotator__panel--active")).toHaveCSS("opacity", "1");
        await expect(homeFrame.locator(".hero-rotator__panel--active").getByText("Điểm riêng của mục hai", { exact: true })).toBeVisible();
        assert.equal(await homeFrame.locator(".hero-rotator__panel--active img").first().evaluate(image => image.getAttribute("src")?.includes("uploads")), true);
        await expect(homeFrame.locator(".hero-rotator__panel").first()).toHaveCSS("opacity", "0");
        await expect(homeFrame.locator('#khoang-cach-tu-cms')).toHaveCSS("background-color", "rgb(224, 242, 254)");
        const spacing = await homeFrame.locator('#khoang-cach-tu-cms > .site-container').evaluate(element => ({ actual: parseFloat(getComputedStyle(element).paddingTop), expected: 7 * parseFloat(getComputedStyle(element.ownerDocument.documentElement).fontSize) }));
        assert.ok(Math.abs(spacing.actual - spacing.expected) < 0.1, "Khoảng cách Rộng phải dùng 7rem từ cấu hình CMS, không dùng padding theo chiều cao màn hình.");
        assert.equal(await homeFrame.locator('.screen-block > #khoang-cach-tu-cms').count(), 0);
        await page.screenshot({ path: ".next/builder-hero-content-preview.png", fullPage: false });
        await page.getByRole("button", { name: "Đóng xem trước", exact: true }).click();
        await page.locator(".admin-blocks__navigation .admin-block__toggle").first().click();
        await homeProperties.getByRole("tab", { name: "Bố cục khối", exact: true }).click();
        await homeProperties.getByRole("group", { name: "Kiểu bố cục", exact: true }).getByText("Trượt nhiều ảnh", { exact: true }).click();
        assert.equal(await homeProperties.getByText("Các ảnh trượt (0/8)", { exact: true }).count(), 0);
        await homeNavigation.getByRole("button", { name: "+ Thêm ảnh trượt", exact: true }).click();
        await expect(homeProperties.getByRole("tab", { name: "Nội dung", exact: true })).toHaveAttribute("aria-selected", "true");
        await expect(homeProperties.getByText("Các ảnh trượt (1/8)", { exact: true })).toBeVisible();
        await homeNavigation.locator(".admin-block__toggle").first().click();
        await homeProperties.getByRole("tab", { name: "Bố cục khối", exact: true }).click();
        assert.equal(await homeProperties.getByRole("slider", { name: "Độ rộng nội dung (%)", exact: true }).count(), 0);
        await expect(homeProperties.getByText("Kiểu trượt nhiều ảnh luôn hiển thị ảnh toàn chiều ngang", { exact: false })).toBeVisible();
      } else assert.equal(await page.locator(".admin-blocks--builder").count(), 0);
    }
    stage = "bố cục chung CMS và publish danh sách";
    const [listingImage] = await input.client`select id from media_assets where original_name like 'builder-panel-%' limit 1`;
    assert.ok(listingImage);
    const listingRoutes = [
      ["listing-service", "/dich-vu", "service"], ["listing-software", "/phan-mem", "software"], ["listing-solution", "/giai-phap", "solution"],
      ["listing-equipment", "/thiet-bi", "equipment"], ["listing-support", "/ho-tro/cai-dat", "downloads"], ["listing-news", "/tin-tuc", "posts"], ["listing-guides", "/ho-tro/huong-dan", "guides"],
    ];
    let serviceId = "";
    for (const [slug, path, source] of listingRoutes) {
      const existing = await (await fetch(backend + "/api/v1/admin/pages?slug=" + slug, { headers })).json();
      const hero = { type: "hero", isEnabled: true, appearance: { anchor: "bo-cuc-da-chon", tone: "custom", backgroundColor: "#eef7ff", width: 75 }, data: { eyebrow: "Dữ liệu CMS", title: "Bố cục " + path, description: "Chỉ chọn ở khối cha", layout: slug === "listing-service" ? "split" : "split_reverse", mediaId: listingImage.id, primaryAction: null, secondaryAction: null, highlights: [{ title: "Điểm nổi bật chung", note: null }], panels: [{ eyebrow: null, title: "Mục trượt 2 " + path, description: "Nội dung con", mediaId: listingImage.id, primaryAction: null, secondaryAction: null, highlights: [{ title: "Điểm nổi bật riêng", note: null }] }] } };
      const response = await post("/api/v1/admin/pages", { id: existing.page.id, expectedVersion: existing.page.draftVersion, values: { ...input.pageValues, slug, template: "listing", title: "Danh sách " + source, blocks: [hero, { type: "collection_list", isEnabled: true, data: { source, eyebrow: null, title: null, description: null, limit: null, anchor: null } }] } });
      assert.equal(response.status, 200, slug);
      if (slug === "listing-service") serviceId = existing.page.id;
    }
    await page.goto(`${cms}/admin/pages/${serviceId}`, { waitUntil: "domcontentloaded" });
    const listingProperties = page.locator(".admin-blocks__detail");
    const listingNavigation = page.locator(".admin-blocks__navigation");
    await expect(listingProperties.getByRole("tab")).toHaveCount(1);
    await expect(listingProperties.getByRole("tab", { name: "Bố cục khối", exact: true })).toBeVisible();
    await listingNavigation.getByRole("button", { name: "Mục trượt 1", exact: true }).click();
    await expect(listingProperties.getByRole("tab")).toHaveCount(1);
    assert.equal(await listingProperties.getByRole("group", { name: "Kiểu bố cục", exact: true }).count(), 0);
    await listingNavigation.getByRole("button", { name: "Bố cục khối", exact: true }).click();
    await listingProperties.getByRole("group", { name: "Kiểu bố cục", exact: true }).getByText("Ảnh trái, chữ phải", { exact: true }).click();
    const savedListing = page.waitForResponse(response => response.url().endsWith("/api/v1/admin/pages") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    assert.equal((await savedListing).status(), 200);
    await expect(page.getByText("Đã lưu thay đổi và tạo phiên bản mới.", { exact: true }).first()).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Xem trước trang", exact: true }).click();
    const listingFrame = page.frameLocator('iframe[title="Bản xem trước website"]');
    await listingFrame.locator("#bo-cuc-da-chon").waitFor({ timeout: 30000 });
    await expect(listingFrame.locator("#bo-cuc-da-chon")).toHaveCSS("background-color", "rgb(238, 247, 255)");
    assert.equal(await listingFrame.locator('#bo-cuc-da-chon [class*="lg:order-2"]').count(), 2);
    await page.getByRole("button", { name: "Đóng xem trước", exact: true }).click();
    const listingSite = await context.newPage();
    for (const [, path] of listingRoutes) {
      await listingSite.goto(website + path, { waitUntil: "domcontentloaded" });
      await expect(listingSite.locator("h1")).toHaveCount(1);
      await expect(listingSite.locator("#bo-cuc-da-chon")).toHaveCount(1);
      await expect(listingSite.locator("#bo-cuc-da-chon")).toHaveCSS("background-color", "rgb(238, 247, 255)");
      assert.equal(await listingSite.locator('#bo-cuc-da-chon [class*="lg:order-2"]').count(), 2, path);
      assert.equal(await listingSite.locator(".listing-hero").count(), 0, path);
      await expect(listingSite.getByRole("navigation", { name: "Đường dẫn", exact: true })).toHaveCount(1);
      const listingGeometry = await listingSite.evaluate(() => ({ hero: document.querySelector("#bo-cuc-da-chon")!.getBoundingClientRect().bottom, breadcrumb: document.querySelector('[aria-label="Đường dẫn"]')!.getBoundingClientRect().top }));
      assert.ok(listingGeometry.breadcrumb >= listingGeometry.hero, "Breadcrumb không được bị hero phủ lên.");
      await expect(listingSite.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(listingSite.locator('meta[name="description"]')).toHaveCount(1);
    }
    await listingSite.goto(website + "/dich-vu", { waitUntil: "domcontentloaded" });
    await listingSite.screenshot({ path: ".next/listing-layout-published.png", fullPage: false });
    await listingSite.close();
    const [offering] = await input.client`select id from offerings where slug='phan-mem-kiem-thu'`;
    const [equipment] = await input.client`select id from sales_equipment where slug='thiet-bi-kiem-thu'`;
    for (const path of [`/admin/products/${offering.id}`, `/admin/equipment/${equipment.id}`]) {
      await page.goto(`${cms}${path}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".admin-blocks--builder")).toBeVisible({ timeout: 30000 });
      assert.equal(await page.locator(".admin-blocks--builder").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), 2);
      await page.getByRole("button", { name: "Xem trước trang", exact: true }).click();
      await page.frameLocator('iframe[title="Bản xem trước website"]').locator('[data-builder-block="0"]').waitFor({ timeout: 30000 });
      await page.getByRole("button", { name: "Đóng xem trước", exact: true }).click();
    }
    // Cùng component Rich Text ở cả hai loại bài, không có builder.
    for (const [slug, route] of [["bai-kiem-thu", "news"], ["huong-dan-kiem-thu", "resources/guides"]]) {
      const [post] = await input.client`select id from posts where slug=${slug}`;
      await page.goto(`${cms}/admin/${route}/${post.id}`, { waitUntil: "domcontentloaded" });
      await page.locator('[contenteditable="true"]').first().waitFor({ timeout: 30000 });
      assert.equal(await page.locator('.admin-blocks--builder').count(), 0);
    }
    assert.deepEqual(clientErrors, []);
    await context.close();
    console.log("Đạt HTTP/trình duyệt: phân quyền, CSRF, 409, CSP/noindex, preview chưa lưu, thẻ SEO không lặp, sitemap, 301; nội dung giữa, preview nổi/cửa sổ riêng, tải/chọn ảnh thật, điểm nổi bật riêng/chung lưu và mở lại, Rich Text chung.");
  } catch (error) { console.error(`HTTP lỗi tại: ${stage}.`, error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[đã ẩn kết nối]") : "Lỗi không xác định"); throw error; } finally {
    await browser?.close();
    const storageCleanup = await Promise.allSettled(uploadedKeys.map(key => removeStoredObject(key)));
    for (const child of children.reverse()) {
      child.kill();
      await Promise.race([new Promise(resolve => child.once("exit", resolve)), wait(5000)]);
    }
    assert.ok(storageCleanup.every(result => result.status === "fulfilled"), "Chưa dọn xong ảnh kiểm thử trên kho tệp.");
  }
}
