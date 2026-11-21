import assert from "node:assert/strict";
import test from "node:test";

import { adminApiError, apiErrorMessage } from "./admin-api";

test("apiErrorMessage đọc message chuẩn của backend", () => {
  assert.equal(apiErrorMessage({ error: { code: "CONFLICT", message: "Dữ liệu đã thay đổi." } }, "Dự phòng"), "Dữ liệu đã thay đổi.");
});

test("apiErrorMessage dùng thông báo dự phòng khi payload không đúng dạng", () => {
  for (const payload of [null, undefined, "<html>", {}, { error: null }, { error: { message: 42 } }, { error: { message: "" } }]) {
    assert.equal(apiErrorMessage(payload, "Dự phòng"), "Dự phòng");
  }
});

test("adminApiError giữ mã lỗi để màn hình nhận ra xung đột phiên bản", () => {
  const error = adminApiError({ error: { code: "VERSION_CONFLICT", message: "Nội dung đã được người khác cập nhật." } }, "Dự phòng");
  assert.equal(error.code, "VERSION_CONFLICT");
  assert.equal(error.message, "Nội dung đã được người khác cập nhật.");
  assert.equal(adminApiError("<html>", "Dự phòng").code, undefined);
});

test("readAdminJson: trang lỗi dạng chữ không làm văng lỗi JSON kỹ thuật", async () => {
  const { readAdminJson, adminApiError, upstreamUnavailableMessage } = await import("./admin-api");
  const proxyError = await readAdminJson(new Response("Internal Server Error", { status: 500 }));
  assert.equal(adminApiError(proxyError, "Không thể lưu trang.").message, upstreamUnavailableMessage);
  assert.equal(await readAdminJson(new Response("<html>", { status: 404 })), null);
  assert.equal(adminApiError(await readAdminJson(new Response("", { status: 404 })), "Không thể lưu trang.").message, "Không thể lưu trang.");
  assert.deepEqual(await readAdminJson(Response.json({ page: { id: "a" } })), { page: { id: "a" } });
  assert.equal(adminApiError(await readAdminJson(Response.json({ error: { code: "X", message: "Lỗi cụ thể" } }, { status: 500 })), "fallback").message, "Lỗi cụ thể");
});
