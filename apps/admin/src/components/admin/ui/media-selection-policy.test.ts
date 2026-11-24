import assert from "node:assert/strict";
import test from "node:test";
import { isSelectableMediaType } from "./media-selection-policy";

const webImages = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
const socialImages = webImages.slice(0, 3);
const documents = [
  "application/pdf", "application/zip", "application/vnd.rar", "application/x-7z-compressed", "application/gzip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

test("trường ảnh, ảnh chia sẻ và tài liệu chỉ gắn loại tệp được phép", () => {
  for (const mime of webImages) {
    assert.equal(isSelectableMediaType(mime, false), true, mime);
    assert.equal(isSelectableMediaType(mime, true), false, mime);
  }
  for (const mime of socialImages) assert.equal(isSelectableMediaType(mime, false, true), true, mime);
  // Ảnh bìa, ảnh chia sẻ và ảnh đại diện không nhận SVG, AVIF, GIF: mạng xã hội không hiện được.
  for (const mime of webImages.slice(3)) assert.equal(isSelectableMediaType(mime, false, true), false, mime);
  for (const mime of documents) {
    assert.equal(isSelectableMediaType(mime, true), true, mime);
    assert.equal(isSelectableMediaType(mime, false), false, mime);
    assert.equal(isSelectableMediaType(mime, false, true), false, mime);
  }
  for (const mime of ["", "text/html", "application/octet-stream", "application/x-msdownload", "application/x-msi", "application/vnd.android.package-archive"]) {
    assert.equal(isSelectableMediaType(mime, true), false, mime);
    assert.equal(isSelectableMediaType(mime, false), false, mime);
    assert.equal(isSelectableMediaType(mime, false, true), false, mime);
  }
});
