import assert from "node:assert/strict";
import test from "node:test";
import { adminSupportDownloadInputSchema, parseSavedSupportDownload, publicSupportDownloadSchema, supportDownloadListResponseSchema } from "./support-downloads.contract";

const id = "12345678-1234-4123-8123-123456789012";
const row = { id, fileMediaId: null, externalUrl: null, groupName: null, icon: "download", title: "Bản nháp", description: null, meta: null, sortOrder: 0, isEnabled: false, downloadUrl: null, originalName: null, mimeType: null, draftVersion: 2, archivedAt: null, status: "draft" as const };
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

const values = { fileMediaId: null, externalUrl: null, icon: "download", title: "Bộ cài đặt", description: null, meta: null, sortOrder: 0, isEnabled: true };
test("nguồn tải: nhận link https, từ chối dùng cả tệp và link, từ chối link không an toàn", () => {
  assert.equal(adminSupportDownloadInputSchema.safeParse({ ...values, externalUrl: "https://example.com/tai-ve/iOrder-Setup.exe" }).success, true);
  assert.equal(adminSupportDownloadInputSchema.safeParse({ ...values, fileMediaId: id, externalUrl: "https://example.com/a.zip" }).success, false);
  for (const externalUrl of ["http://example.com/a.zip", "javascript:alert(1)", "https://user:pass@example.com/a.zip", "example.com", "", "https://"]) {
    assert.equal(adminSupportDownloadInputSchema.safeParse({ ...values, externalUrl }).success, false, externalUrl);
  }
});
test("bản lưu cũ (lịch sử phiên bản) chưa có externalUrl vẫn đọc được và coi là không có link", () => {
  const legacy: Record<string, unknown> = { ...values };
  delete legacy.externalUrl;
  assert.equal(adminSupportDownloadInputSchema.parse(legacy).externalUrl, null);
});
test("địa chỉ tải công khai là tệp trong thư viện hoặc link https, kèm cờ external", () => {
  const base = { id, icon: "download", title: "Tệp", description: null, meta: null, groupName: null };
  assert.equal(publicSupportDownloadSchema.safeParse({ ...base, downloadUrl: "/media/uploads/a.zip", external: false }).success, true);
  assert.equal(publicSupportDownloadSchema.safeParse({ ...base, downloadUrl: "https://example.com/a.exe", external: true }).success, true);
  for (const downloadUrl of ["http://example.com/a.exe", "javascript:alert(1)", "//example.com/a", "uploads/a.zip"]) {
    assert.equal(publicSupportDownloadSchema.safeParse({ ...base, downloadUrl, external: true }).success, false, downloadUrl);
  }
  assert.equal(publicSupportDownloadSchema.safeParse({ ...base, downloadUrl: "/media/uploads/a.zip" }).success, false);
});

test("nhóm hiển thị: cắt khoảng trắng, tối đa 120 ký tự, không nhận chuỗi rỗng, thiếu thì là không nhóm", () => {
  assert.equal(adminSupportDownloadInputSchema.parse({ ...values, groupName: "  Driver trên Windows  " }).groupName, "Driver trên Windows");
  assert.equal(adminSupportDownloadInputSchema.parse({ ...values, groupName: null }).groupName, null);
  const legacy: Record<string, unknown> = { ...values };
  delete legacy.groupName;
  assert.equal(adminSupportDownloadInputSchema.parse(legacy).groupName, null);
  assert.equal(adminSupportDownloadInputSchema.safeParse({ ...values, groupName: "a".repeat(121) }).success, false);
  assert.equal(adminSupportDownloadInputSchema.safeParse({ ...values, groupName: "   " }).success, false);
});
