import assert from "node:assert/strict";
import test from "node:test";
import { revisionHistoryResponseSchema, restoreRevisionSchema } from "./revisions.contract";

const row = { id: "12345678-1234-4123-8123-123456789012", version: 1, note: null, snapshot: { title: "Nội dung" }, createdAt: "2026-10-10T00:00:00Z" };

test("khôi phục luôn yêu cầu phiên bản người dùng đã mở", () => {
  assert.equal(restoreRevisionSchema.safeParse({ revisionId: row.id }).success, false);
  assert.equal(restoreRevisionSchema.safeParse({ revisionId: row.id, expectedVersion: 0 }).success, true);
  for (const expectedVersion of [null, "1", -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(restoreRevisionSchema.safeParse({ revisionId: row.id, expectedVersion }).success, false);
  }
});

test("lịch sử chấp nhận dữ liệu hiện hữu và danh sách rỗng", () => {
  assert.equal(revisionHistoryResponseSchema.safeParse({ revisions: [row] }).success, true);
  assert.equal(revisionHistoryResponseSchema.safeParse({ revisions: [] }).success, true);
});

test("lịch sử từ chối payload thiếu, phiên bản sai và ID trùng", () => {
  for (const value of [{}, { revisions: null }, { revisions: [{}] }, { revisions: [row, row] },
    ...[0, -1, 1.5, "1"].map(version => ({ revisions: [{ ...row, version }] })),
    { revisions: [{ ...row, snapshot: undefined }] }, { revisions: [{ ...row, id: "sai" }] }]) {
    assert.equal(revisionHistoryResponseSchema.safeParse(value).success, false);
  }
});
