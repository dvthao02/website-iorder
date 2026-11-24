import assert from "node:assert/strict";
import test from "node:test";

import { avatarUploadOptions, createMediaDeletionService, detectUploadedFileType, InvalidMediaError, MediaInUseError, unsafeSvgReason, uploadAdminMedia } from "./media.service";

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

const ascii = (text: string) => Buffer.from(text, "ascii");
const zipWith = (...names: string[]) => Buffer.concat([Buffer.from([80, 75, 3, 4, 0, 0]), ...names.map((name) => ascii(name))]);

test("Nhận dạng thêm GIF, AVIF, SVG, RAR, 7Z, GZ theo nội dung", () => {
  assert.deepEqual(detectUploadedFileType(ascii("GIF89a....")), { mimeType: "image/gif", extension: "gif" });
  assert.deepEqual(detectUploadedFileType(ascii("GIF87a....")), { mimeType: "image/gif", extension: "gif" });
  const ftyp = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 24]), ascii(`ftyp${brand}`), Buffer.alloc(12)]);
  assert.deepEqual(detectUploadedFileType(ftyp("avif")), { mimeType: "image/avif", extension: "avif" });
  assert.deepEqual(detectUploadedFileType(ftyp("avis")), { mimeType: "image/avif", extension: "avif" });
  assert.equal(detectUploadedFileType(ftyp("heic")), null, "HEIC (ảnh iPhone) chưa hỗ trợ");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
  assert.deepEqual(detectUploadedFileType(Buffer.from(svg)), { mimeType: "image/svg+xml", extension: "svg" });
  assert.deepEqual(detectUploadedFileType(Buffer.from(`\uFEFF<?xml version="1.0" encoding="UTF-8"?>\n<!-- logo -->\n${svg}`)), { mimeType: "image/svg+xml", extension: "svg" });
  assert.equal(detectUploadedFileType(Buffer.from("<html><body>không phải ảnh</body></html>")), null);
  assert.deepEqual(detectUploadedFileType(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0xcf])), { mimeType: "application/vnd.rar", extension: "rar" });
  assert.deepEqual(detectUploadedFileType(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00])), { mimeType: "application/vnd.rar", extension: "rar" });
  assert.equal(detectUploadedFileType(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x02])), null);
  assert.deepEqual(detectUploadedFileType(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4])), { mimeType: "application/x-7z-compressed", extension: "7z" });
  assert.deepEqual(detectUploadedFileType(Buffer.from([0x1f, 0x8b, 8, 0])), { mimeType: "application/gzip", extension: "gz" });
});

test("Tài liệu Word, Excel, PowerPoint nhận ra qua các phần bên trong gói ZIP; ZIP thường vẫn là ZIP", () => {
  const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const pptx = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  assert.deepEqual(detectUploadedFileType(zipWith("[Content_Types].xml", "word/document.xml")), { mimeType: docx, extension: "docx" });
  assert.deepEqual(detectUploadedFileType(zipWith("[Content_Types].xml", "xl/workbook.xml")), { mimeType: xlsx, extension: "xlsx" });
  assert.deepEqual(detectUploadedFileType(zipWith("[Content_Types].xml", "ppt/presentation.xml")), { mimeType: pptx, extension: "pptx" });
  assert.deepEqual(detectUploadedFileType(zipWith("huong-dan.txt")), { mimeType: "application/zip", extension: "zip" });
  assert.deepEqual(detectUploadedFileType(zipWith("word/document.xml")), { mimeType: "application/zip", extension: "zip" }, "thiếu [Content_Types].xml thì không phải Office");
});

test("SVG chứa script, sự kiện, liên kết ngoài hoặc thực thể bị từ chối; SVG sạch được nhận", async () => {
  const clean = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><defs><linearGradient id="a"/></defs><metadata>logo</metadata><use xlink:href="#a"/><path d="M0 0h10v10z" fill="#fff"/></svg>';
  assert.equal(unsafeSvgReason(Buffer.from(clean)), null);
  const unsafe = [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>x</text></a></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="//evil.example/a.svg#x"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>x</div></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/a.css);</style></svg>',
    '<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg"></svg>',
  ];
  for (const svg of unsafe) assert.notEqual(unsafeSvgReason(Buffer.from(svg)), null, svg);
  const userId = "33333333-3333-4333-8333-333333333333";
  await assert.rejects(uploadAdminMedia(new File([Buffer.from(unsafe[0])], "logo.svg"), userId), (error: unknown) => error instanceof InvalidMediaError && /SVG/.test(error.message));
});

// Các nhánh từ chối chạy trước khi chạm vào kho lưu trữ nên kiểm tra được mà không cần S3.
test("Ảnh đại diện: chỉ nhận ảnh, không quá 2 MB, không rỗng", async () => {
  const userId = "33333333-3333-4333-8333-333333333333";
  assert.deepEqual(avatarUploadOptions, { folder: "avatars", maxBytes: 2 * 1024 * 1024, imagesOnly: true });
  await assert.rejects(uploadAdminMedia(new File([Buffer.from("%PDF-1.7", "ascii")], "cv.pdf", { type: "image/png" }), userId, avatarUploadOptions), (error: unknown) => error instanceof InvalidMediaError && /PNG, JPEG hoặc WebP/.test(error.message));
  await assert.rejects(uploadAdminMedia(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "lon.png"), userId, avatarUploadOptions), (error: unknown) => error instanceof InvalidMediaError && /2 MB/.test(error.message));
  await assert.rejects(uploadAdminMedia(new File([], "rong.png"), userId, avatarUploadOptions), InvalidMediaError);
  // GIF, SVG và AVIF hợp lệ làm ảnh trong trang nhưng không làm ảnh đại diện (mạng xã hội không hiện SVG/AVIF).
  for (const [name, body] of [["a.gif", ascii("GIF89a....")], ["a.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')]] as const) {
    await assert.rejects(uploadAdminMedia(new File([body], name), userId, avatarUploadOptions), (error: unknown) => error instanceof InvalidMediaError && /PNG, JPEG hoặc WebP/.test(error.message));
  }
  // Không có tùy chọn thì giữ nguyên hành vi cũ: giới hạn 20 MB, nhận cả PDF/ZIP.
  await assert.rejects(uploadAdminMedia(new File([new Uint8Array(20 * 1024 * 1024 + 1)], "lon.pdf"), userId), (error: unknown) => error instanceof InvalidMediaError && /20 MB/.test(error.message));
});
