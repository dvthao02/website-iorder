import assert from "node:assert/strict";
import { test } from "node:test";

import { visibleUpdatedAt } from "./article-dates";

const published = new Date("2026-10-21T10:00:00Z");

test("Chỉ hiện ngày cập nhật khi bài được sửa sau ngày đăng ít nhất một ngày", () => {
  const later = new Date("2026-11-20T08:00:00Z");
  assert.equal(visibleUpdatedAt(published, later), later);
  assert.equal(visibleUpdatedAt(published, new Date("2026-10-21T10:05:00Z")), null);
  assert.equal(visibleUpdatedAt(published, new Date("2026-10-22T09:59:59Z")), null);
  assert.ok(visibleUpdatedAt(published, new Date("2026-10-22T10:00:00Z")));
});

test("Thiếu ngày đăng/ngày sửa, hoặc ngày sửa trước ngày đăng thì không hiện", () => {
  assert.equal(visibleUpdatedAt(null, new Date()), null);
  assert.equal(visibleUpdatedAt(published, null), null);
  assert.equal(visibleUpdatedAt(published, new Date("2026-09-01T00:00:00Z")), null);
});
