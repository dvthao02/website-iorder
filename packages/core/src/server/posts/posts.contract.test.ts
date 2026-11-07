import assert from "node:assert/strict";
import test from "node:test";

import { adminPostListItemSchema, postCategoriesRequestSchema, uncategorizedGuideGroup } from "./posts.contract";

const id = "4d978bed-080c-40d6-9d77-e099e3f3a12c";

test("Chuyển nhóm: chỉ nhận { categoryIds, expectedVersion }; mảng rỗng là bỏ chuyên mục", () => {
  assert.deepEqual(postCategoriesRequestSchema.parse({ categoryIds: [id], expectedVersion: 3 }), { categoryIds: [id], expectedVersion: 3 });
  assert.deepEqual(postCategoriesRequestSchema.parse({ categoryIds: [], expectedVersion: 0 }).categoryIds, []);
  // Thân request lưu đầy đủ (có title, status…) không bị hiểu nhầm là chuyển nhóm.
  assert.equal(postCategoriesRequestSchema.safeParse({ categoryIds: [id], expectedVersion: 3, title: "Bán hàng" }).success, false);
  assert.equal(postCategoriesRequestSchema.safeParse({ categoryIds: ["khong-phai-uuid"], expectedVersion: 3 }).success, false);
  assert.equal(postCategoriesRequestSchema.safeParse({ categoryIds: [id] }).success, false);
});

test("Dòng danh sách bài trong CMS có chuyên mục (mặc định rỗng); nhãn nhóm chưa phân loại dùng chung với website", () => {
  const row = { id, type: "guide", title: "Bán hàng", slug: "ban-hang", status: "published", draftVersion: 1, updatedAt: new Date(), coverUrl: null };
  assert.deepEqual(adminPostListItemSchema.parse(row).categories, []);
  assert.deepEqual(adminPostListItemSchema.parse({ ...row, categories: [{ id, name: "Cài đặt thiết bị" }] }).categories, [{ id, name: "Cài đặt thiết bị" }]);
  assert.equal(uncategorizedGuideGroup, "Hướng dẫn chung");
});
