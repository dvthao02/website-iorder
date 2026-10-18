import assert from "node:assert/strict";
import test from "node:test";

import { searchAdminCms } from "./global-search.service";

// Không có DATABASE_URL trong test: nếu service truy vấn module bị cấm, getDb() sẽ ném lỗi.
test("Tìm kiếm chỉ trả route CMS mà người dùng được xem và không truy vấn module bị cấm", async () => {
  const results = await searchAdminCms("khach", { role: "support", permissions: ["leads.view"] });
  assert.deepEqual(results.map((item) => item.href), ["/admin/khach-hang-tiem-nang"]);
});

test("Route quản trị bị ẩn khi thiếu quyền tương ứng", async () => {
  const results = await searchAdminCms("nguoi dung", { role: "support", permissions: ["leads.view"] });
  assert.equal(results.some((item) => item.href === "/admin/tai-khoan"), false);
});

test("Route không gắn quyền (giao diện CMS) luôn tìm thấy", async () => {
  const results = await searchAdminCms("giao-dien", { role: "support", permissions: [] });
  assert.deepEqual(results.map((item) => item.href), ["/admin/giao-dien-cms"]);
});
