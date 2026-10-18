import { expect, test } from "@playwright/test";

import { adminCredentials } from "./helpers";

// Xuất CSV khách hàng tiềm năng: tải được theo bộ lọc, mở đúng tiếng Việt trong Excel (BOM), cần đăng nhập.
test("Xuất CSV khách hàng tiềm năng", async ({ request, baseURL, playwright }) => {
  const anonymous = await playwright.request.newContext({ baseURL });
  expect((await anonymous.get("/api/admin/leads/export")).status()).toBe(401);
  await anonymous.dispose();

  const headers = { origin: baseURL!, "content-type": "application/json" };
  expect((await request.post("/api/admin/session", { headers, data: adminCredentials() })).status()).toBe(200);
  const response = await request.get("/api/admin/leads/export?status=all");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="khach-hang-tiem-nang-\d{4}-\d{2}-\d{2}\.csv"/);
  const body = (await response.body()).toString("utf8");
  expect(body.startsWith("﻿Thời điểm gửi,Họ tên,Điện thoại,Email")).toBe(true);
  expect((await request.get("/api/admin/leads/export?status=khong-hop-le")).status()).toBe(400);
});
