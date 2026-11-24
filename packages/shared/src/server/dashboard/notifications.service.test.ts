import assert from "node:assert/strict";
import test from "node:test";

import { notificationTotal } from "./notifications.contract";
import { getAdminNotifications, leadNotificationLimit, leadNotifications, loginFailureNotifications, reviewNotifications, siteConfigNotifications, type LeadNotificationRow } from "./notifications.service";

// Không có DATABASE_URL trong test: nếu service truy vấn module bị thiếu quyền, getDb() sẽ ném lỗi.
test("Thông báo không truy vấn gì khi người xem không có quyền lead hay xuất bản", async () => {
  assert.deepEqual(await getAdminNotifications({ role: "editor", permissions: ["posts.view", "posts.update", "pages.view"] }), []);
});

const now = new Date("2026-11-24T08:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const lead = (patch: Partial<LeadNotificationRow> = {}): LeadNotificationRow => ({ id: "11111111-1111-4111-8111-111111111111", name: "Văn Thao", phone: "+84964350515", need: null, deviceName: null, createdAt: ago(5), mine: false, assigneeName: null, ...patch });

test("Mỗi liên hệ một thông báo nói rõ gọi lại ai, hỏi gì, số nào, bao lâu, và mở thẳng liên hệ đó", () => {
  assert.deepEqual(leadNotifications({ total: 0, overdue: 0, items: [] }, now), []);
  const [device, general] = leadNotifications({ total: 2, overdue: 0, items: [lead({ deviceName: "Máy quét mã vạch ATS-1400-D" }), lead({ id: "22222222-2222-4222-8222-222222222222", name: "Nguyễn Thi", phone: "9093823823", need: "Phần mềm bán hàng", createdAt: ago(90) })] }, now);
  assert.deepEqual(device, { id: "lead-11111111-1111-4111-8111-111111111111", label: "Gọi lại Văn Thao — hỏi mua Máy quét mã vạch ATS-1400-D", detail: "0964 350 515 · 5 phút trước", href: "/admin/leads?open=11111111-1111-4111-8111-111111111111", tone: "normal", fingerprint: "new" });
  // Số cũ sai quy tắc giữ nguyên như khách đã nhập; không có thiết bị thì nêu nhu cầu.
  assert.equal(general.label, "Gọi lại Nguyễn Thi — Phần mềm bán hàng");
  assert.equal(general.detail, "9093823823 · 1 giờ trước");
  assert.equal(leadNotifications({ total: 1, overdue: 0, items: [lead()] }, now)[0].label, "Gọi lại Văn Thao");
});

test("Liên hệ quá hạn có dấu hiệu khẩn kèm thời gian đã chờ; liên hệ được giao cho mình nói rõ", () => {
  const [overdue, assigned] = leadNotifications({ total: 2, overdue: 1, items: [lead({ createdAt: ago(3 * 24 * 60 + 30) }), lead({ id: "33333333-3333-4333-8333-333333333333", mine: true })] }, now);
  assert.equal(overdue.tone, "urgent");
  assert.equal(overdue.detail, "0964 350 515 · chờ 3 ngày chưa xử lý");
  assert.equal(assigned.tone, "normal");
  assert.equal(assigned.detail, "Giao cho bạn · 0964 350 515 · 5 phút trước");
  // Dấu hiệu nội dung đổi khi liên hệ quá hạn hoặc vừa được giao cho mình: thông báo đã đọc/xóa trước đó hiện lại.
  assert.deepEqual([overdue.fingerprint, assigned.fingerprint], ["overdue", "new:mine"]);
});

test("Người quản lý thấy liên hệ đã giao cho người khác mà quá hạn, nói rõ ai chưa gọi lại", () => {
  const [other] = leadNotifications({ total: 1, overdue: 1, items: [lead({ createdAt: ago(2 * 24 * 60 + 5), assigneeName: "Chị Lan", deviceName: "Máy POS X1" })] }, now);
  assert.equal(other.label, "Chị Lan chưa gọi lại Văn Thao — hỏi mua Máy POS X1");
  assert.equal(other.detail, "0964 350 515 · chờ 2 ngày chưa xử lý");
  assert.equal(other.tone, "urgent");
  // Dấu hiệu riêng, để thông báo này không lẫn với thông báo liên hệ chưa giao đã đọc/xóa trước đó.
  assert.equal(other.fingerprint, "overdue:other");
});

test("Liên hệ vượt giới hạn gộp một dòng dẫn tới danh sách cũ nhất trước và tính đủ số việc", () => {
  const items = Array.from({ length: leadNotificationLimit }, (_, index) => lead({ id: `00000000-0000-4000-8000-00000000000${index}`, createdAt: ago(index + 1) }));
  const result = leadNotifications({ total: 12, overdue: 0, items }, now);
  assert.equal(result.length, leadNotificationLimit + 1);
  const more = result.at(-1)!;
  assert.deepEqual([more.id, more.label, more.count, more.href], ["leads-more", "Còn 7 liên hệ khác chưa xử lý", 7, "/admin/leads?status=new&sort=createdAt&dir=asc"]);
  assert.equal(notificationTotal(result), 12);
  // Phần còn lại có liên hệ quá hạn thì nói rõ và đánh dấu khẩn (2 liên hệ quá hạn, 1 đã nêu riêng).
  const overdueItems = [lead({ createdAt: ago(30 * 60) }), ...items.slice(1)];
  const withOverdue = leadNotifications({ total: 8, overdue: 3, items: overdueItems }, now).at(-1)!;
  assert.equal(withOverdue.tone, "urgent");
  assert.match(withOverdue.detail, /^Trong đó 2 liên hệ chờ quá 24 giờ/);
  assert.equal(leadNotifications({ total: 5, overdue: 0, items }, now).length, 5);
});

test("Mỗi mục chờ duyệt một thông báo mở thẳng trang sửa; vượt giới hạn gộp một dòng", () => {
  const rows = [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Hướng dẫn kết nối máy POS", updatedAt: ago(125) },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Tin khuyến mãi tháng 12", updatedAt: ago(20) },
  ];
  assert.deepEqual(reviewNotifications("posts", [], 0, now), []);
  assert.deepEqual(reviewNotifications("posts", rows, 2, now), [
    { id: "review-posts-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "Duyệt bài viết: Hướng dẫn kết nối máy POS", detail: "Chờ xuất bản · sửa lần cuối 2 giờ trước", href: "/admin/news/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fingerprint: "2026-11-24T05:55:00.000Z" },
    { id: "review-posts-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", label: "Duyệt bài viết: Tin khuyến mãi tháng 12", detail: "Chờ xuất bản · sửa lần cuối 20 phút trước", href: "/admin/news/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", fingerprint: "2026-11-24T07:40:00.000Z" },
  ]);
  const hrefs = (kind: Parameters<typeof reviewNotifications>[0]) => reviewNotifications(kind, rows.slice(0, 1), 1, now)[0].href;
  assert.deepEqual(["pages", "guides", "software", "solution", "equipment"].map((kind) => hrefs(kind as Parameters<typeof reviewNotifications>[0])), [
    "/admin/pages/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "/admin/guides/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "/admin/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "/admin/solutions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "/admin/equipment/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ]);
  // 3 mục được nêu riêng, 5 mục chờ duyệt: dòng gộp "Còn 2 …" tính 2 việc.
  const many = Array.from({ length: 3 }, (_, index) => ({ id: `cccccccc-cccc-4ccc-8ccc-cccccccccc0${index}`, title: `Thiết bị ${index}`, updatedAt: ago(index + 1) }));
  const result = reviewNotifications("equipment", many, 5, now);
  assert.equal(result.length, 4);
  assert.deepEqual([result[3].label, result[3].count, result[3].href, result[3].fingerprint], ["Còn 2 thiết bị khác chờ duyệt", 2, "/admin/equipment?status=review", "2"]);
  assert.equal(notificationTotal(result), 5);
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
  assert.equal(item?.tone, "urgent");
  // Thêm tài khoản bị nhập sai thì là diễn biến mới.
  assert.notEqual(loginFailureNotifications(3)[0]?.fingerprint, item?.fingerprint);
});
