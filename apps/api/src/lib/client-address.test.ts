import assert from "node:assert/strict";
import { test } from "node:test";

import { getClientAddress } from "./client-address";

test("Lấy IP ngoài cùng do Caddy thêm thay vì giá trị client tự chèn", () => {
  assert.equal(getClientAddress("198.51.100.4, 203.0.113.8", null), "203.0.113.8");
  assert.equal(getClientAddress("198.51.100.4, 2001:db8::8", null), "2001:db8::8");
});

test("Chỉ nhận IP hợp lệ và dùng X-Real-IP khi không có X-Forwarded-For", () => {
  assert.equal(getClientAddress(null, "203.0.113.8"), "203.0.113.8");
  assert.equal(getClientAddress("not-an-ip", "203.0.113.8"), null);
  assert.equal(getClientAddress(null, "not-an-ip"), null);
});
