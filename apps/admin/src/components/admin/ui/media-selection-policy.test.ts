import assert from "node:assert/strict";
import test from "node:test";
import { isSelectableMediaType } from "./media-selection-policy";

test("trường ảnh và tài liệu chỉ gắn loại tệp được phép", () => {
  for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
    assert.equal(isSelectableMediaType(mime, false), true);
    assert.equal(isSelectableMediaType(mime, true), false);
  }
  for (const mime of ["application/pdf", "application/zip"]) {
    assert.equal(isSelectableMediaType(mime, true), true);
    assert.equal(isSelectableMediaType(mime, false), false);
  }
  for (const mime of ["", "image/svg+xml", "text/html", "application/octet-stream"]) {
    assert.equal(isSelectableMediaType(mime, true), false);
    assert.equal(isSelectableMediaType(mime, false), false);
  }
});
