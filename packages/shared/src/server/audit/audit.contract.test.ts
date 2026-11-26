import assert from "node:assert/strict";
import { test } from "node:test";
import { auditListPageSchema, auditListQuerySchema, auditPurgeRequestSchema } from "./audit.contract";

test("Bộ lọc nhật ký chuẩn hóa khi parse và từ chối giới hạn/trường sai", () => {
  assert.deepEqual(auditListQuerySchema.parse({}), { page: 1, pageSize: 25, query: "", entityType: "" });
  assert.equal(auditListQuerySchema.parse({ query: "  Tiếng Việt  ", entityType: " equipment " }).entityType, "equipment");
  for (const value of [{ page: 0 }, { pageSize: 101 }, { query: "a".repeat(161) }, { entityType: "a".repeat(101) }, { unknown: true }]) assert.equal(auditListQuerySchema.safeParse(value).success, false);
});
test("Trang nhật ký kiểm metadata/ID/ngày và chỉ trả fields hiển thị", () => {
  const row = { id: "12345678-1234-4234-8234-123456789abc", action: "equipment.update", entityType: "equipment", entityId: null, createdAt: new Date("2026-10-10T00:00:00Z"), userName: null, userUsername: null, ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0", requestId: "req-12345678", changedFields: ["title"], beforeData: { secret: "fixture" }, afterData: { secret: "fixture" } };
  const page = { items: [row], page: 1, pageSize: 25, total: 1, totalPages: 1 };
  const parsed = auditListPageSchema.parse(page);
  assert.equal("beforeData" in parsed.items[0], false);
  assert.equal("afterData" in parsed.items[0], false);
  for (const patch of [{ total: 0 }, { totalPages: 2 }, { items: [] }, { items: [{ ...row, id: "sai" }] }, { items: [{ ...row, createdAt: new Date("sai") }] }, { items: [row, row], total: 2 }]) assert.equal(auditListPageSchema.safeParse({ ...page, ...patch }).success, false);
  assert.equal(auditListPageSchema.safeParse({ ...page, items: [], total: 0 }).success, true);
});
test("Nhãn đăng nhập/đăng xuất và trường thay đổi bỏ trường kỹ thuật", async () => {
  const { auditActionLabel, auditFieldLabels, auditLabelSearchCodes } = await import("./audit-labels");
  assert.equal(auditActionLabel("user.login"), "Đăng nhập");
  assert.equal(auditActionLabel("user.login_failed"), "Đăng nhập thất bại (sai mật khẩu)");
  assert.ok(auditLabelSearchCodes("đăng xuất").actions.includes("user.logout"));
  assert.deepEqual(auditFieldLabels(["title", "version", "updatedAt", "customField"]), ["Tiêu đề", "customField"]);
});

const id = "12345678-1234-4234-8234-123456789abc";
test("Yêu cầu dọn nhật ký: bốn phạm vi, mặc định không phải dryRun, từ chối trường lạ", () => {
  assert.deepEqual(auditPurgeRequestSchema.parse({ mode: "all" }), { mode: "all", dryRun: false });
  assert.deepEqual(auditPurgeRequestSchema.parse({ mode: "older_than", days: 90, dryRun: true }), { mode: "older_than", days: 90, dryRun: true });
  assert.deepEqual(auditPurgeRequestSchema.parse({ mode: "selected", ids: [id] }), { mode: "selected", ids: [id], dryRun: false });
  for (const days of [1, 7, 30, 90, 180, 365]) assert.equal(auditPurgeRequestSchema.safeParse({ mode: "older_than", days }).success, true, `mốc ${days} ngày`);
  assert.equal(auditPurgeRequestSchema.safeParse({ mode: "older_than", days: 2 }).success, false, "chỉ nhận các mốc có sẵn");
  for (const value of [{}, { mode: "everything" }, { mode: "all", days: 30 }, { mode: "all", extra: 1 }, { mode: "older_than" }, { mode: "older_than", days: 15 }, { mode: "older_than", days: "30" }, { mode: "all", dryRun: "yes" }]) {
    assert.equal(auditPurgeRequestSchema.safeParse(value).success, false, JSON.stringify(value));
  }
});

test("Xóa các dòng đã chọn: 1–200 mã hợp lệ", () => {
  assert.equal(auditPurgeRequestSchema.safeParse({ mode: "selected", ids: [] }).success, false);
  assert.equal(auditPurgeRequestSchema.safeParse({ mode: "selected", ids: ["không-phải-uuid"] }).success, false);
  assert.equal(auditPurgeRequestSchema.safeParse({ mode: "selected", ids: Array.from({ length: 201 }, () => id) }).success, false);
  assert.equal(auditPurgeRequestSchema.safeParse({ mode: "selected", ids: Array.from({ length: 200 }, () => id) }).success, true);
});

test("Xóa theo bộ lọc: bộ lọc phải có ít nhất một điều kiện và nghiêm ngặt (giá trị sai không bị bỏ qua làm rộng phạm vi xóa)", () => {
  assert.equal(auditPurgeRequestSchema.safeParse({ mode: "filtered", filter: {} }).success, false, "bộ lọc rỗng = xóa hết: phải chọn toàn bộ");
  assert.equal(auditPurgeRequestSchema.safeParse({ mode: "filtered", filter: { query: "   " } }).success, false, "chỉ khoảng trắng cũng là rỗng");
  assert.equal(auditPurgeRequestSchema.safeParse({ mode: "filtered", filter: { verb: "create", from: "2026-11-01", to: "2026-11-30" } }).success, true);
  for (const filter of [{ verb: "khong-co" }, { from: "01/11/2026" }, { from: "2026-13-45" }, { userId: "abc" }, { query: "x".repeat(161) }, { verb: "create", page: 2 }]) {
    assert.equal(auditPurgeRequestSchema.safeParse({ mode: "filtered", filter }).success, false, JSON.stringify(filter));
  }
});
