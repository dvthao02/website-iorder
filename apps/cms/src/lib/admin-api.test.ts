import assert from "node:assert/strict";
import test from "node:test";

import { apiErrorMessage } from "./admin-api";

test("apiErrorMessage đọc message chuẩn của backend", () => {
  assert.equal(apiErrorMessage({ error: { code: "CONFLICT", message: "Dữ liệu đã thay đổi." } }, "Dự phòng"), "Dữ liệu đã thay đổi.");
});

test("apiErrorMessage dùng thông báo dự phòng khi payload không đúng dạng", () => {
  for (const payload of [null, undefined, "<html>", {}, { error: null }, { error: { message: 42 } }, { error: { message: "" } }]) {
    assert.equal(apiErrorMessage(payload, "Dự phòng"), "Dự phòng");
  }
});
