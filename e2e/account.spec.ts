import { expect, test, type APIRequestContext } from "@playwright/test";

import { adminCredentials } from "./helpers";

const username = "e2e-doi-mat-khau";

// Tài khoản kiểm thử riêng: tạo mới hoặc đặt lại mật khẩu qua quyền admin, cuối test khóa lại.
async function resetTestUser(request: APIRequestContext, origin: string, password: string, status: "active" | "disabled") {
  const headers = { origin, "content-type": "application/json" };
  const list = await (await request.get(`/api/admin/users?query=${username}`)).json() as { result: { items: Array<{ id: string; username: string }> }; roles: Array<{ code: string }> };
  const existing = list.result.items.find((item) => item.username === username);
  const role = list.roles.find((item) => item.code !== "admin")?.code ?? list.roles[0].code;
  const response = await request.post("/api/admin/users", { headers, data: { id: existing?.id ?? null, values: { username, email: null, fullName: "Kiểm thử đổi mật khẩu", role, status, password } } });
  expect(response.status()).toBe(200);
}

test("Tài khoản tự đổi mật khẩu: mật khẩu cũ hết hiệu lực, mật khẩu mới đăng nhập được", async ({ page, request, baseURL }) => {
  const origin = baseURL!;
  const headers = { origin, "content-type": "application/json" };
  expect((await request.post("/api/admin/session", { headers, data: adminCredentials() })).status()).toBe(200);
  const oldPassword = `Cu-${Date.now()}-matkhau`;
  const newPassword = `Moi-${Date.now()}-matkhau`;
  await resetTestUser(request, origin, oldPassword, "active");

  try {
    await page.goto("/admin/login");
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill(oldPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin(\/)?$/);

    await page.goto("/admin/tai-khoan-cua-toi");
    await expect(page.getByText(username, { exact: true })).toBeVisible();
    await page.getByLabel("Mật khẩu hiện tại", { exact: true }).fill("sai-mat-khau-hien-tai");
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill(newPassword);
    await page.getByLabel("Nhập lại mật khẩu mới").fill(newPassword);
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await expect(page.getByText("Mật khẩu hiện tại không đúng.").first()).toBeVisible();

    await page.getByLabel("Mật khẩu hiện tại", { exact: true }).fill(oldPassword);
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await expect(page.getByText(/Đã đổi mật khẩu/).first()).toBeVisible();

    const login = (password: string) => page.request.post("/api/admin/session", { headers, data: { username, password } });
    expect((await login(oldPassword)).status()).toBe(401);
    expect((await login(newPassword)).status()).toBe(200);
  } finally {
    await resetTestUser(request, origin, `Khoa-${Date.now()}-matkhau`, "disabled");
  }
});
