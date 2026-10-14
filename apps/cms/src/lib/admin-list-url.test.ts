import assert from "node:assert/strict";
import test from "node:test";
import { outOfRangeListHref } from "./admin-list-url";
test("Trang hợp lệ không redirect, trang vượt giới hạn giữ filter an toàn", () => {
  for (const page of [1, 2]) assert.equal(outOfRangeListHref("/admin/san-pham", { page, totalPages: 2 }, {}), undefined);
  const filters = { query: "trạm sạc & ?", status: "draft" };
  const href = outOfRangeListHref("/admin/san-pham", { page: 999, totalPages: 2 }, filters);
  assert.ok(href);
  const url = new URL(href, "http://cms.local");
  assert.equal(url.pathname, "/admin/san-pham");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("query"), filters.query);
  assert.equal(url.searchParams.get("status"), "draft");
});
test("Danh sách rỗng về trang 1 và URL đích không redirect tiếp", () => {
  assert.equal(outOfRangeListHref("/admin/tin-tuc", { page: 999, totalPages: 1 }, {}), "/admin/tin-tuc?page=1");
  assert.equal(outOfRangeListHref("/admin/tin-tuc", { page: 1, totalPages: 1 }, {}), undefined);
});
