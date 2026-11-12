import assert from "node:assert/strict";
import test from "node:test";
import { pageSizeOptions } from "./page-size-options";

test("Giá trị hợp lệ trên URL luôn có option, không trùng và theo thứ tự", () => {
  assert.deepEqual(pageSizeOptions(7), [5, 7, 10, 25, 50, 100]);
  assert.deepEqual(pageSizeOptions(25), [5, 10, 25, 50, 100]);
});
test("Không thêm pageSize sai và không sửa danh sách giữa các lần gọi", () => {
  for (const value of [0, 101, 7.5, NaN, Infinity]) assert.deepEqual(pageSizeOptions(value), [5, 10, 25, 50, 100]);
  pageSizeOptions(7).push(8);
  assert.deepEqual(pageSizeOptions(7), [5, 7, 10, 25, 50, 100]);
});
