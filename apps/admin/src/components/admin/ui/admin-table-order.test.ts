import assert from "node:assert/strict";
import test from "node:test";

import { mergeColumnOrder } from "./admin-table-order";

const defaults = ["title", "group", "file", "status", "sortOrder", "actions"];

test("không có thứ tự lưu thì dùng thứ tự mặc định", () => {
  assert.deepEqual(mergeColumnOrder(undefined, defaults), defaults);
});

test("cột mới được chèn sau cột đứng trước nó, không rơi sau cột Thao tác", () => {
  assert.deepEqual(mergeColumnOrder(["title", "file", "status", "sortOrder", "actions"], defaults), defaults);
});

test("giữ thứ tự người dùng đã kéo và bỏ cột không còn tồn tại", () => {
  assert.deepEqual(mergeColumnOrder(["status", "old", "title", "actions", "file", "sortOrder", "group"], defaults), ["status", "title", "actions", "file", "sortOrder", "group"]);
});

test("cột mới đứng đầu mặc định thì chèn vào đầu bảng", () => {
  assert.deepEqual(mergeColumnOrder(["b", "c"], ["a", "b", "c"]), ["a", "b", "c"]);
});
