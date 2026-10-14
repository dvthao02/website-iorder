import assert from "node:assert/strict";
import { test } from "node:test";
import { auditListPageSchema, auditListQuerySchema } from "./audit.contract";

test("Bộ lọc nhật ký chuẩn hóa khi parse và từ chối giới hạn/trường sai", () => {
  assert.deepEqual(auditListQuerySchema.parse({}), { page: 1, pageSize: 25, query: "", entityType: "" });
  assert.equal(auditListQuerySchema.parse({ query: "  Tiếng Việt  ", entityType: " equipment " }).entityType, "equipment");
  for (const value of [{ page: 0 }, { pageSize: 101 }, { query: "a".repeat(161) }, { entityType: "a".repeat(101) }, { unknown: true }]) assert.equal(auditListQuerySchema.safeParse(value).success, false);
});
test("Trang nhật ký kiểm metadata/ID/ngày và chỉ trả fields hiển thị", () => {
  const row = { id: "12345678-1234-4234-8234-123456789abc", action: "equipment.update", entityType: "equipment", entityId: null, createdAt: new Date("2026-10-10T00:00:00Z"), userName: null, userUsername: null, beforeData: { secret: "fixture" }, afterData: { secret: "fixture" } };
  const page = { items: [row], page: 1, pageSize: 25, total: 1, totalPages: 1 };
  const parsed = auditListPageSchema.parse(page);
  assert.equal("beforeData" in parsed.items[0], false);
  assert.equal("afterData" in parsed.items[0], false);
  for (const patch of [{ total: 0 }, { totalPages: 2 }, { items: [] }, { items: [{ ...row, id: "sai" }] }, { items: [{ ...row, createdAt: new Date("sai") }] }, { items: [row, row], total: 2 }]) assert.equal(auditListPageSchema.safeParse({ ...page, ...patch }).success, false);
  assert.equal(auditListPageSchema.safeParse({ ...page, items: [], total: 0 }).success, true);
});
