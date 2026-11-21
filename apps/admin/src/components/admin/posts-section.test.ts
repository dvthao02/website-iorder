import assert from "node:assert/strict";
import test from "node:test";

import { postsSectionHref, postsSectionLabel } from "./posts-section";

test("đường dẫn các tab của Bài viết & Tin tức", () => {
  assert.equal(postsSectionHref("posts"), "/admin/news");
  assert.equal(postsSectionHref("categories"), "/admin/taxonomy");
  assert.equal(postsSectionHref("tags"), "/admin/taxonomy?kind=tags");
  assert.equal(postsSectionHref("authors"), "/admin/authors");
});

test("nhãn tab", () => {
  assert.deepEqual((["posts", "categories", "tags", "authors"] as const).map(postsSectionLabel), ["Bài viết", "Chuyên mục", "Thẻ", "Tác giả"]);
});
