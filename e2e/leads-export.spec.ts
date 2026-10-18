import { expect, test } from "@playwright/test";

import { adminCredentials, loginAsAdmin } from "./helpers";

// Xuất khách hàng tiềm năng: CSV (BOM cho tiếng Việt) và Excel theo bộ lọc, cần đăng nhập.
test("Xuất CSV và Excel khách hàng tiềm năng", async ({ request, baseURL, playwright }) => {
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

  // Excel: file zip (bắt đầu bằng "PK") đúng kiểu nội dung và đuôi .xlsx, lọc theo khoảng ngày.
  const excel = await request.get("/api/admin/leads/export?format=xlsx&status=all&from=2026-01-01&to=2026-12-31");
  expect(excel.status()).toBe(200);
  expect(excel.headers()["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect(excel.headers()["content-disposition"]).toMatch(/filename="khach-hang-tiem-nang-\d{4}-\d{2}-\d{2}\.xlsx"/);
  expect((await excel.body()).subarray(0, 2).toString("latin1")).toBe("PK");
  expect((await request.get("/api/admin/leads/export?format=pdf")).status()).toBe(400);
});

test("Màn khách hàng tiềm năng: bảng, khoảng thời gian chọn nhanh, nút xuất theo bộ lọc", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/khach-hang-tiem-nang");
  const period = page.getByLabel("Khoảng thời gian gửi");
  await expect(period).toHaveValue("all");
  await expect(page.locator("input[type=date]")).toHaveCount(0);
  await period.selectOption("30d");
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("link", { name: "Xuất Excel" })).toHaveAttribute("href", /format=xlsx.*from=/);
  await page.getByLabel("Khoảng thời gian gửi").selectOption("custom");
  await expect(page.locator("input[type=date]")).toHaveCount(2);
});
