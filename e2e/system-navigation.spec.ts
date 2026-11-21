import { randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";

import { loginAsAdmin, adminCredentials } from "./helpers";

// Thanh bên CMS và nghiệp vụ nhóm Hệ thống: thứ tự nhóm, nhóm tự mở lại, quyền theo vai trò, lối tắt chỉ dẫn tới trang mở được.
// Tạo vai trò và tài khoản thử nên chỉ chạy trên CMS + DB local (API không xóa được tài khoản nên dọn trực tiếp).
const created: { roleIds: string[]; userIds: string[] } = { roleIds: [], userIds: [] };
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
const isLocal = (url: string | undefined) => Boolean(url) && localHosts.includes(new URL(url!).hostname);
test.skip(!isLocal(process.env.DATABASE_URL) || !isLocal(process.env.E2E_CMS_URL ?? "http://localhost:3001"), "Chỉ chạy trên CMS + DB local.");

test.afterAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!isLocal(url) || !created.roleIds.length) return;
  const sql = postgres(url!, { max: 1, onnotice: () => undefined });
  try {
    for (const id of created.userIds) await sql`delete from users where id = ${id} and username like 'sysnav-%'`;
    for (const id of created.roleIds) await sql`delete from roles where id = ${id} and is_system = false`;
  } finally { await sql.end({ timeout: 5 }); }
});

const toggle = (page: Page, label: string) => page.locator(".admin-sidebar").getByRole("button", { name: label, exact: true });
const itemsOf = (page: Page, label: string) => page.locator(".admin-sidebar .admin-navigation__group").filter({ has: page.getByRole("button", { name: label, exact: true }) }).locator(".admin-navigation__link");

async function createLimitedUser(request: APIRequestContext, baseURL: string, name: string, permissions: string[]) {
  const headers = { origin: baseURL, "content-type": "application/json" };
  expect((await request.post("/api/v1/admin/session", { headers, data: adminCredentials() })).status()).toBe(200);
  const role = await request.post("/api/v1/admin/roles", { headers, data: { id: null, values: { name: `${name} ${randomBytes(2).toString("hex")}`, description: null, permissions } } });
  expect(role.status()).toBeLessThan(300);
  const roleId = (await role.json()).id as string;
  created.roleIds.push(roleId);
  const roleCode = ((await (await request.get("/api/v1/admin/roles")).json()).roles as Array<{ id: string; code: string }>).find((item) => item.id === roleId)!.code;
  const username = `sysnav-${randomBytes(3).toString("hex")}`;
  const password = randomBytes(18).toString("base64url");
  const user = await request.post("/api/v1/admin/users", { headers, data: { id: null, values: { username, email: null, fullName: name, status: "active", role: roleCode, password } } });
  expect(user.status()).toBeLessThan(300);
  created.userIds.push((await user.json()).id as string);
  return { username, password };
}

async function signInAs(browser: Browser, baseURL: string, account: { username: string; password: string }) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/admin/login");
  await page.locator('input[name="username"]').fill(account.username);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin(\/)?$/);
  return { context, page };
}

test("Thanh bên có 5 nhóm theo công việc; theo dõi hiệu quả nằm chung Công việc; Hệ thống đi từ vận hành tới truy cập", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsAdmin(page);
  await expect(page.locator(".admin-sidebar .admin-navigation__group-toggle")).toHaveText(["Công việc", "Nội dung website", "Cấu trúc website", "Cài đặt website", "Hệ thống"]);
  await expect(itemsOf(page, "Công việc")).toHaveText(["Bảng điều khiển", "Khách hàng tiềm năng", "Thống kê truy cập", "Google Search Console", "Kiểm tra trước xuất bản"]);
  await expect(itemsOf(page, "Cấu trúc website")).toHaveText(["Menu & Điều hướng", "Chuyển hướng URL", "Cửa sổ tư vấn"]);
  await expect(itemsOf(page, "Cài đặt website")).toHaveText(["Thông tin doanh nghiệp", "Tên miền & SEO", "Liên kết & Mạng xã hội"]);
  await expect(itemsOf(page, "Hệ thống")).toHaveText(["Tình trạng hệ thống", "Sao lưu & phục hồi", "Người dùng & vai trò", "Nhật ký hoạt động", "Kết nối & khóa API"]);

  // Mục chuyển nhóm vẫn mở đúng trang và sáng đúng mục.
  await page.locator(".admin-sidebar").getByRole("link", { name: "Google Search Console" }).click();
  await expect(page).toHaveURL(/\/admin\/search-console$/);
  await expect(page.locator(".admin-sidebar").getByRole("link", { name: "Google Search Console" })).toHaveAttribute("aria-current", "page");
});

test("Gập nhóm Hệ thống rồi mở trang thuộc nhóm bằng liên kết trong trang: nhóm tự mở lại và mục đang chọn sáng", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsAdmin(page);
  await page.goto("/admin/system");
  const backupLink = page.getByRole("link", { name: "Mở Sao lưu & phục hồi" });
  await expect(backupLink).toBeVisible();

  await toggle(page, "Hệ thống").click();
  await expect(toggle(page, "Hệ thống")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".admin-sidebar").getByRole("link", { name: "Tình trạng hệ thống" })).toBeHidden();

  await backupLink.click();
  await expect(page).toHaveURL(/\/admin\/backup$/);
  await expect(toggle(page, "Hệ thống")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".admin-sidebar").getByRole("link", { name: "Sao lưu & phục hồi" })).toHaveAttribute("aria-current", "page");

  // Người dùng gập lại khi vẫn ở trang đó thì được giữ nguyên, không bị mở lại.
  await toggle(page, "Hệ thống").click();
  await expect(toggle(page, "Hệ thống")).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(600);
  await expect(toggle(page, "Hệ thống")).toHaveAttribute("aria-expanded", "false");
});

test("Vận hành hệ thống (chỉ system.view): chỉ thấy phần theo dõi; lối tắt ở Tình trạng hệ thống chỉ tới trang mở được", async ({ browser, request, baseURL }) => {
  const account = await createLimitedUser(request, baseURL!, "Thử vận hành hệ thống", ["dashboard.view", "audit.view", "system.view"]);
  const { context, page } = await signInAs(browser, baseURL!, account);
  try {
    await expect(page.locator(".admin-sidebar .admin-navigation__link")).toHaveText(["Bảng điều khiển", "Thống kê truy cập", "Tình trạng hệ thống", "Sao lưu & phục hồi", "Nhật ký hoạt động"]);
    await page.goto("/admin/system");
    const content = page.locator(".admin-shell__scroll");
    await expect(content.getByRole("link", { name: "Mở Sao lưu & phục hồi" })).toBeVisible();
    // Trang cài đặt và khóa API người này không mở được nên không có lối tắt dẫn tới.
    await expect(content.locator('a[href="/admin/integrations"], a[href="/admin/search-console"], a[href="/admin/seo"]')).toHaveCount(0);

    expect((await context.request.get("/api/v1/admin/backup")).status()).toBe(200);
    expect((await context.request.get("/api/v1/admin/publishing-config")).status()).toBe(403);
    for (const blocked of ["/admin/integrations", "/admin/search-console", "/admin/seo"]) {
      await page.goto(blocked);
      await expect(page).toHaveURL(/\/admin\/forbidden/);
    }
  } finally { await context.close(); }

  // Super Admin vẫn thấy lối tắt tới Kết nối & khóa API ở cùng màn (Umami chưa nối trong môi trường thử).
  const admin = await browser.newContext({ baseURL: baseURL!, viewport: { width: 1440, height: 900 } });
  try {
    const adminPage = await admin.newPage();
    await loginAsAdmin(adminPage);
    await adminPage.goto("/admin/system");
    await expect(adminPage.locator('.admin-shell__scroll a[href="/admin/integrations"]').first()).toBeVisible();
  } finally { await admin.close(); }
});

test("Vai trò chỉ có quyền cài đặt (nội dung/marketing) không thấy Sao lưu và Tình trạng hệ thống, API cũng chặn", async ({ browser, request, baseURL }) => {
  const account = await createLimitedUser(request, baseURL!, "Thử cài đặt", ["dashboard.view", "settings.view"]);
  const { context, page } = await signInAs(browser, baseURL!, account);
  try {
    const labels = await page.locator(".admin-sidebar .admin-navigation__link").allTextContents();
    expect(labels).toContain("Tên miền & SEO");
    for (const hidden of ["Sao lưu & phục hồi", "Tình trạng hệ thống", "Kết nối & khóa API", "Nhật ký hoạt động"]) expect(labels, hidden).not.toContain(hidden);
    expect((await context.request.get("/api/v1/admin/backup")).status()).toBe(403);
    expect((await context.request.get("/api/v1/admin/system-status")).status()).toBe(403);
    await page.goto("/admin/backup");
    await expect(page).toHaveURL(/\/admin\/forbidden/);
  } finally { await context.close(); }
});
