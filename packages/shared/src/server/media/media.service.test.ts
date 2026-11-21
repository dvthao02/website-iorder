import assert from "node:assert/strict";
import test from "node:test";

import { avatarUploadOptions, createMediaDeletionService, detectUploadedFileType, InvalidMediaError, MediaInUseError, uploadAdminMedia } from "./media.service";

const mediaId = "11111111-1111-4111-8111-111111111111";
const editorId = "22222222-2222-4222-8222-222222222222";

function createRepository(options: { exists?: boolean; usage?: number } = {}) {
  let queued = 0;
  const repository = {
    async findMediaAsset() { return options.exists === false ? undefined : { id: mediaId }; },
    async collectMediaUsage() { return Array.from({ length: options.usage ?? 0 }, (_, index) => ({ entityId: String(index) })); },
    async queueMediaAssetDeletion() { queued += 1; return { id: mediaId }; },
  } as unknown as Parameters<typeof createMediaDeletionService>[0];
  return { queued: () => queued, repository };
}

test("chỉ đưa media không được dùng vào hàng đợi dọn dẹp", async () => {
  const fake = createRepository();
  const service = createMediaDeletionService(fake.repository);

  assert.equal(await service.deleteAdminMedia(mediaId, editorId), mediaId);
  assert.equal(fake.queued(), 1);
});

test("không queue media đang được tham chiếu", async () => {
  const fake = createRepository({ usage: 1 });
  const service = createMediaDeletionService(fake.repository);

  await assert.rejects(service.deleteAdminMedia(mediaId, editorId), MediaInUseError);
  assert.equal(fake.queued(), 0);
});

test("không queue mã không hợp lệ hoặc media đã không còn hoạt động", async () => {
  const missing = createRepository({ exists: false });
  const service = createMediaDeletionService(missing.repository);

  assert.equal(await service.deleteAdminMedia("not-a-uuid", editorId), undefined);
  assert.equal(await service.deleteAdminMedia(mediaId, editorId), undefined);
  assert.equal(missing.queued(), 0);
});

test("Nhận dạng tệp theo nội dung, không theo đuôi tệp", () => {
  assert.deepEqual(detectUploadedFileType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])), { mimeType: "image/png", extension: "png" });
  assert.deepEqual(detectUploadedFileType(Buffer.from([255, 216, 255, 224])), { mimeType: "image/jpeg", extension: "jpg" });
  assert.deepEqual(detectUploadedFileType(Buffer.from("RIFF0000WEBPVP8 ", "ascii")), { mimeType: "image/webp", extension: "webp" });
  assert.deepEqual(detectUploadedFileType(Buffer.from("%PDF-1.7", "ascii")), { mimeType: "application/pdf", extension: "pdf" });
  assert.deepEqual(detectUploadedFileType(Buffer.from([80, 75, 3, 4, 0])), { mimeType: "application/zip", extension: "zip" });
  assert.equal(detectUploadedFileType(Buffer.from("MZ chương trình .exe", "utf8")), null);
});

// Các nhánh từ chối chạy trước khi chạm vào kho lưu trữ nên kiểm tra được mà không cần S3.
test("Ảnh đại diện: chỉ nhận ảnh, không quá 2 MB, không rỗng", async () => {
  const userId = "33333333-3333-4333-8333-333333333333";
  assert.deepEqual(avatarUploadOptions, { folder: "avatars", maxBytes: 2 * 1024 * 1024, imagesOnly: true });
  await assert.rejects(uploadAdminMedia(new File([Buffer.from("%PDF-1.7", "ascii")], "cv.pdf", { type: "image/png" }), userId, avatarUploadOptions), (error: unknown) => error instanceof InvalidMediaError && /PNG, JPEG hoặc WebP/.test(error.message));
  await assert.rejects(uploadAdminMedia(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "lon.png"), userId, avatarUploadOptions), (error: unknown) => error instanceof InvalidMediaError && /2 MB/.test(error.message));
  await assert.rejects(uploadAdminMedia(new File([], "rong.png"), userId, avatarUploadOptions), InvalidMediaError);
  // Không có tùy chọn thì giữ nguyên hành vi cũ: giới hạn 20 MB, nhận cả PDF/ZIP.
  await assert.rejects(uploadAdminMedia(new File([new Uint8Array(20 * 1024 * 1024 + 1)], "lon.pdf"), userId), (error: unknown) => error instanceof InvalidMediaError && /20 MB/.test(error.message));
});
