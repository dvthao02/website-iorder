import assert from "node:assert/strict";
import { test } from "node:test";

import { applyNotificationStates, type NotificationState } from "./notification-state";
import { adminNotificationActionSchema, unreadNotificationCount, type AdminNotification } from "./notifications.contract";

const item = (id: string, patch: Partial<AdminNotification> = {}): AdminNotification => ({ id, label: id, detail: "", href: "/admin", ...patch });
const states = (entries: Array<[string, NotificationState]>) => new Map(entries);

test("Thông báo chưa có trạng thái nào là chưa đọc", () => {
  assert.deepEqual(applyNotificationStates([item("a"), item("b")], states([])).map((row) => [row.id, row.read]), [["a", false], ["b", false]]);
});

test("Đã đọc thì đánh dấu read, đã xóa thì ẩn, chỉ khi dấu hiệu nội dung còn khớp", () => {
  const result = applyNotificationStates(
    [item("lead-1", { fingerprint: "new" }), item("lead-2", { fingerprint: "new" }), item("lead-3", { fingerprint: "new" })],
    states([["lead-1", { fingerprint: "new", state: "read" }], ["lead-2", { fingerprint: "new", state: "dismissed" }]]),
  );
  assert.deepEqual(result.map((row) => [row.id, row.read]), [["lead-1", true], ["lead-3", false]]);
});

test("Dấu hiệu đổi (quá hạn, bài sửa lại, số việc tăng) thì thông báo đã đọc hoặc đã xóa hiện lại như mới", () => {
  const saved = states([["lead-1", { fingerprint: "new", state: "dismissed" }], ["lead-2", { fingerprint: "new", state: "read" }], ["review-x", { fingerprint: "", state: "read" }]]);
  const result = applyNotificationStates([item("lead-1", { fingerprint: "overdue" }), item("lead-2", { fingerprint: "new:mine" }), item("review-x")], saved);
  assert.deepEqual(result.map((row) => [row.id, row.read]), [["lead-1", false], ["lead-2", false], ["review-x", true]]);
});

test("Danh sách đầu vào không bị sửa và các trường khác được giữ nguyên", () => {
  const source = [item("a", { count: 4, tone: "urgent", fingerprint: "x" })];
  const result = applyNotificationStates(source, states([]));
  assert.equal(source[0].read, undefined);
  assert.deepEqual(result[0], { ...source[0], read: false });
});

test("Số chưa đọc chỉ tính thông báo chưa đọc, dòng gộp tính theo số việc", () => {
  assert.equal(unreadNotificationCount([item("a"), item("b", { read: true }), item("c", { count: 7, read: false }), item("d", { count: 3, read: true })]), 8);
  assert.equal(unreadNotificationCount([]), 0);
  assert.equal(unreadNotificationCount([item("a", { read: true })]), 0);
});

test("Thao tác thông báo: đọc/bỏ đọc/xóa theo mã, hoặc đọc hết/xóa hết; không nhận trường lạ", () => {
  assert.deepEqual(adminNotificationActionSchema.parse({ action: "read", ids: ["lead-1"] }), { action: "read", ids: ["lead-1"] });
  for (const action of ["unread", "dismiss"] as const) assert.equal(adminNotificationActionSchema.safeParse({ action, ids: ["a", "b"] }).success, true);
  for (const action of ["read_all", "dismiss_all"] as const) assert.deepEqual(adminNotificationActionSchema.parse({ action }), { action });
  for (const value of [{}, { action: "read" }, { action: "read", ids: [] }, { action: "read", ids: [""] }, { action: "read", ids: ["a".repeat(161)] }, { action: "read_all", ids: ["a"] }, { action: "delete_all" }, { action: "read", ids: ["a"], extra: 1 }, { action: "read", ids: Array.from({ length: 101 }, (_, index) => `k${index}`) }]) {
    assert.equal(adminNotificationActionSchema.safeParse(value).success, false, JSON.stringify(value).slice(0, 80));
  }
});
