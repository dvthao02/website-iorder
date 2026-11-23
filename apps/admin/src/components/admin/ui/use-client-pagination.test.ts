import assert from "node:assert/strict";
import test from "node:test";

import { paginateRows } from "./use-client-pagination";

const rows = Array.from({ length: 53 }, (_, index) => index + 1);

test("Cắt đúng trang, đúng tổng số và tổng số trang", () => {
  const first = paginateRows(rows, 1, 25);
  assert.deepEqual([first.rows.length, first.rows[0], first.rows.at(-1), first.total, first.totalPages, first.page], [25, 1, 25, 53, 3, 1]);
  const last = paginateRows(rows, 3, 25);
  assert.deepEqual([last.rows, last.page], [[51, 52, 53], 3]);
});

test("Trang vượt giới hạn hoặc không hợp lệ được kẹp, danh sách rỗng vẫn có 1 trang", () => {
  assert.equal(paginateRows(rows, 99, 25).page, 3, "quá trang cuối thì về trang cuối (ví dụ vừa xóa mục cuối)");
  assert.equal(paginateRows(rows, 0, 25).page, 1);
  assert.equal(paginateRows(rows, -4, 25).page, 1);
  assert.equal(paginateRows(rows, Number.NaN, 25).page, 1);
  const empty = paginateRows([], 5, 25);
  assert.deepEqual([empty.rows, empty.page, empty.totalPages, empty.total], [[], 1, 1, 0]);
});

test("Đổi số dòng/trang đổi số trang; số dòng sai dùng mặc định 25", () => {
  assert.equal(paginateRows(rows, 1, 10).totalPages, 6);
  assert.equal(paginateRows(rows, 1, 100).totalPages, 1);
  assert.equal(paginateRows(rows, 1, 0).pageSize, 25);
  assert.equal(paginateRows(rows, 1, -5).pageSize, 25);
});
