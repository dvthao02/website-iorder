import assert from "node:assert/strict";
import test from "node:test";
import { parseSavedSupportDownload, supportDownloadListResponseSchema } from "./support-downloads.contract";

const id = "12345678-1234-4123-8123-123456789012";
const row = { id, fileMediaId: null, icon: "download", title: "Bản nháp", description: null, meta: null, sortOrder: 0, isEnabled: false, downloadUrl: null, originalName: null, mimeType: null, draftVersion: 2, archivedAt: null, status: "draft" as const };
const expected = { id, version: 2, status: "draft" as const };
test("danh sách không che phản hồi lỗi thành rỗng, nhận ngày đã revive", () => {
  assert.deepEqual(supportDownloadListResponseSchema.parse({ downloads: [] }).downloads, []);
  const archivedAt = new Date("2026-10-11T00:00:00Z");
  assert.equal(supportDownloadListResponseSchema.parse({ downloads: [{ ...row, archivedAt }] }).downloads[0].archivedAt, archivedAt.toISOString());
  for (const payload of [null, {}, { downloads: null }, { downloads: [{}] }, { downloads: [row, row] }, { downloads: [{ ...row, archivedAt: new Date(NaN) }] }]) {
    assert.equal(supportDownloadListResponseSchema.safeParse(payload).success, false);
  }
});
test("phản hồi lưu đúng ID, version và trạng thái được chấp nhận", () => {
  assert.deepEqual(parseSavedSupportDownload({ download: row }, expected), row);
  assert.ok(parseSavedSupportDownload({ download: { ...row, draftVersion: 1 } }, { version: 1, status: "draft" }));
});
test("không đánh dấu đã lưu khi phản hồi thiếu hoặc không khớp", () => {
  for (const payload of [null, {}, { download: {} }, ...[
    { id: "sai" }, { id: "87654321-1234-4123-8123-123456789012" }, { draftVersion: 1 }, { draftVersion: 3 }, { draftVersion: 2.5 }, { status: "archived" }, { title: "" },
  ].map(patch => ({ download: { ...row, ...patch } }))]) {
    assert.equal(parseSavedSupportDownload(payload, expected), undefined);
  }
});
