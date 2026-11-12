import assert from "node:assert/strict";
import { test } from "node:test";

import { toSlug } from "./slug";

test("Slug bỏ dấu tiếng Việt, đổi đ thành d và chỉ giữ chữ, số, gạch nối", () => {
  assert.equal(toSlug("Nhà hàng - Café Đà Lạt"), "nha-hang-cafe-da-lat");
  assert.equal(toSlug("  Máy in   hóa đơn 80mm!! "), "may-in-hoa-don-80mm");
  assert.equal(toSlug("Quản lý kho", 8), "quan-ly");
  assert.equal(toSlug("!!!"), "");
});
