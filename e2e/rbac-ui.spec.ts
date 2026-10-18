import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

import { adminCredentials } from "./helpers";

// UI of a role with posts.view/update + pages.view only. The API cannot delete
// accounts, so the created role/user are removed directly; local DB only.
const created: { roleId?: string; userId?: string } = {};
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
const isLocal = (url: string | undefined) => Boolean(url) && localHosts.includes(new URL(url!).hostname);

// Creates an account; only against a local CMS whose database the test can clean.
test.skip(!isLocal(process.env.DATABASE_URL) || !isLocal(process.env.E2E_CMS_URL ?? "http://localhost:3001"), "Chỉ chạy trên CMS + DB local.");

test.afterAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!isLocal(url) || !created.roleId) return;
  const sql = postgres(url!, { max: 1, onnotice: () => undefined });
  try {
    // User first: the role cannot be removed while assigned.
    if (created.userId) await sql`delete from users where id = ${created.userId} and username like 'rbac-ui-%'`;
    await sql`delete from roles where id = ${created.roleId} and is_system = false`;
  } finally { await sql.end({ timeout: 5 }); }
});

test("Tài khoản giới hạn chỉ thấy đúng thao tác được phép", async ({ page, request, baseURL }) => {
  const headers = { origin: baseURL!, "content-type": "application/json" };
  const login = await request.post("/api/admin/session", { headers, data: adminCredentials() });
  expect(login.status()).toBe(200);
  const role = await request.post("/api/admin/roles", { headers, data: { id: null, values: { name: "Thử UI giới hạn", description: null, permissions: ["posts.view", "posts.update", "pages.view"] } } });
  const roleId = (await role.json()).id as string;
  const roleCode = ((await (await request.get("/api/admin/roles")).json()).roles as Array<{ id: string; code: string }>).find((r) => r.id === roleId)!.code;
  const username = `rbac-ui-${randomBytes(3).toString("hex")}`;
  const password = randomBytes(18).toString("base64url");
  const user = await request.post("/api/admin/users", { headers, data: { id: null, values: { username, email: null, fullName: "Thử UI giới hạn", status: "active", role: roleCode, password } } });
  created.roleId = roleId;
  created.userId = (await user.json()).id;

  await page.goto("/admin/login");
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin(\/)?$/);

  await expect(page.getByRole("link", { name: "Bài viết & Tin tức" }).first()).toBeAttached();
  await expect(page.getByRole("link", { name: "Vai trò & quyền" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Người dùng CMS" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Thư viện media" })).toHaveCount(0);

  await page.goto("/admin/tin-tuc");
  await expect(page.locator("table, [role='table'], .admin-data-table").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /mới$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Lưu trữ / })).toHaveCount(0);

  await page.goto("/admin/pages");
  await expect(page.getByRole("link", { name: "Tạo trang" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Lưu trữ / })).toHaveCount(0);

  // Mở thẳng URL module bị cấm: màn "Không có quyền" thay vì form trống.
  for (const path of ["/admin/media", "/admin/khach-hang-tiem-nang", "/admin/thiet-bi"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/khong-co-quyen$/);
    await expect(page.getByRole("heading", { name: /chưa được cấp quyền/ })).toBeVisible();
  }

  // posts.update đủ để sửa trang danh sách /tin-tuc (quyền theo module sở hữu).
  await page.goto("/admin/tin-tuc");
  await page.getByRole("link", { name: "Sửa phần đầu trang & SEO" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: "Lưu thay đổi" })).toBeAttached();
  await expect(page.getByRole("button", { name: "Lưu thay đổi" })).not.toHaveAttribute("title", /không có quyền/);
});
