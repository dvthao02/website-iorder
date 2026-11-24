import assert from "node:assert/strict";
import test from "node:test";
import { fileKindOf } from "./admin-file-icon";

test("Loại tệp nén (ZIP, RAR, 7Z, GZ), ảnh và tài liệu Office nhận đúng biểu tượng", () => {
  for (const value of ["application/zip", "application/vnd.rar", "application/x-7z-compressed", "application/gzip", "bo-cai.zip", "bo-cai.rar", "bo-cai.7z", "du-lieu.gz"]) assert.equal(fileKindOf(value), "zip", value);
  for (const value of ["image/png", "image/avif", "image/svg+xml", "logo.avif", "logo.svg"]) assert.equal(fileKindOf(value), "image", value);
  assert.equal(fileKindOf("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "word");
  assert.equal(fileKindOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "excel");
  assert.equal(fileKindOf("application/pdf"), "pdf");
  assert.equal(fileKindOf("library-notes.txt"), "text", "tên có chữ rar không bị nhận nhầm là tệp nén");
});
