import assert from "node:assert/strict";
import test from "node:test";

import { paginationItems, parseJumpPage } from "./pagination-model";

test("Ít trang thì hiện hết số trang, danh sách rỗng vẫn có trang 1", () => {
  assert.deepEqual(paginationItems(1, 0), [1]);
  assert.deepEqual(paginationItems(1, 1), [1]);
  assert.deepEqual(paginationItems(3, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test("Nhiều trang: luôn 7 ô, có trang đầu/cuối và trang hiện tại, phần xa thu thành dấu …", () => {
  assert.deepEqual(paginationItems(1, 12), [1, 2, 3, 4, 5, "gap-end", 12]);
  assert.deepEqual(paginationItems(4, 12), [1, 2, 3, 4, 5, "gap-end", 12]);
  assert.deepEqual(paginationItems(6, 12), [1, "gap-start", 5, 6, 7, "gap-end", 12]);
  assert.deepEqual(paginationItems(9, 12), [1, "gap-start", 8, 9, 10, 11, 12]);
  assert.deepEqual(paginationItems(12, 12), [1, "gap-start", 8, 9, 10, 11, 12]);
  for (let page = 1; page <= 40; page++) {
    const items = paginationItems(page, 40);
    assert.equal(items.length, 7, `trang ${page}`);
    assert.ok(items.includes(page), `trang ${page}`);
    assert.equal(items[0], 1);
    assert.equal(items.at(-1), 40);
  }
});

test("Trang hiện tại nằm ngoài khoảng thì được kẹp lại", () => {
  assert.deepEqual(paginationItems(99, 12), paginationItems(12, 12));
  assert.deepEqual(paginationItems(0, 12), paginationItems(1, 12));
});

test("Nhảy tới trang: nhận số hợp lệ, kẹp về trang cuối, bỏ qua mọi thứ còn lại", () => {
  assert.equal(parseJumpPage("5", 12), 5);
  assert.equal(parseJumpPage(" 12 ", 12), 12);
  assert.equal(parseJumpPage("99", 12), 12);
  assert.equal(parseJumpPage("3", 0), 1);
  for (const typed of ["", "0", "-2", "1.5", "abc", "1e3", "٣"]) assert.equal(parseJumpPage(typed, 12), null, typed);
});
