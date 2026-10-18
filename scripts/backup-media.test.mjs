import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { keyToRelativePath, relativePathToKey } from "./backup-media.mjs";

test("key S3 hợp lệ ánh xạ thành đường dẫn và ngược lại", () => {
  const relative = keyToRelativePath("media/2026/10/a.jpg");
  assert.equal(relative, path.join("media", "2026", "10", "a.jpg"));
  assert.equal(relativePathToKey(relative), "media/2026/10/a.jpg");
});

test("từ chối key có thể thoát khỏi thư mục sao lưu", () => {
  for (const key of ["", "../x", "a/../../x", "/etc/passwd", "a//b", "a/./b", "a\\b", "a/b.part"]) {
    assert.equal(keyToRelativePath(key), null, key);
  }
});
