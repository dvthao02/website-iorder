import assert from "node:assert/strict";
import test from "node:test";

import { getAdminNotifications, leadNotifications, loginFailureNotifications, siteConfigNotifications } from "./notifications.service";

// Không có DATABASE_URL trong test: nếu service truy vấn module bị thiếu quyền, getDb() sẽ ném lỗi.
test("Thông báo không truy vấn gì khi người xem không có quyền lead hay xuất bản", async () => {
  assert.deepEqual(await getAdminNotifications({ role: "editor", permissions: ["posts.view", "posts.update", "pages.view"] }), []);
});

test("Lead quá hạn và lead mới tách thành hai dòng không đếm trùng", () => {
  assert.deepEqual(leadNotifications(0, 0), []);
  assert.deepEqual(leadNotifications(3, 0).map((item) => [item.id, item.detail]), [["leads-new", "3 liên hệ chưa xử lý."]]);
  assert.deepEqual(leadNotifications(5, 2).map((item) => [item.id, item.detail]), [
    ["leads-overdue", "2 liên hệ chưa được xử lý sau hơn 24 giờ."],
    ["leads-new", "3 liên hệ chưa xử lý."],
  ]);
  // Mọi lead đều đã quá hạn: không còn dòng "mới" rỗng.
  assert.deepEqual(leadNotifications(2, 2).map((item) => item.id), ["leads-overdue"]);
});

test("Cấu hình website: chỉ báo khi thiếu tên miền hoặc tên miền thật đang chặn lập chỉ mục", () => {
  assert.deepEqual(siteConfigNotifications(null), []);
  assert.deepEqual(siteConfigNotifications({ siteUrl: null, allowSearchIndexing: false }).map((item) => item.id), ["site-url"]);
  assert.deepEqual(siteConfigNotifications({ siteUrl: "https://iorder.vn", allowSearchIndexing: false }).map((item) => item.id), ["site-indexing"]);
  assert.deepEqual(siteConfigNotifications({ siteUrl: "https://iorder.vn", allowSearchIndexing: true }), []);
});

test("Website đang dựng trên máy phát triển tắt lập chỉ mục là chủ ý, không báo", () => {
  for (const siteUrl of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000", "https://iorder.local", "https://staging.iorder.test"]) {
    assert.deepEqual(siteConfigNotifications({ siteUrl, allowSearchIndexing: false }), [], siteUrl);
  }
});

test("Đăng nhập sai nhiều lần: chỉ báo khi có tài khoản đạt ngưỡng, dẫn tới nhật ký đã lọc", () => {
  assert.deepEqual(loginFailureNotifications(0), []);
  const [item] = loginFailureNotifications(2);
  assert.equal(item?.id, "login-failures");
  assert.equal(item?.detail, "2 tài khoản bị nhập sai mật khẩu từ 5 lần trong 24 giờ qua.");
  assert.equal(item?.href, "/admin/audit-log?verb=login_failed");
});
