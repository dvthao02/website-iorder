import assert from "node:assert/strict";
import test from "node:test";

import { adminPostInputSchema, adminPostListItemSchema, postCategoriesRequestSchema, publicPostDetailSchema, uncategorizedGuideGroup } from "./posts.contract";

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

const postInput = { type: "news", title: "Bài", slug: "bai", excerpt: null, content: { version: 2, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung bài." }] }] } }, status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null, promotionStartAt: null, promotionEndAt: null, ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null };

test("Tác giả bài viết: không gửi vẫn hợp lệ (giữ giá trị đã lưu); chức danh, tên được cắt khoảng trắng; trang cá nhân chỉ nhận http(s)", () => {
  assert.equal(adminPostInputSchema.safeParse(postInput).success, true);
  const parsed = adminPostInputSchema.parse({ ...postInput, authorName: "  Nguyễn Văn An ", authorTitle: " Chuyên viên triển khai ", authorUrl: "https://www.linkedin.com/in/an" });
  assert.deepEqual([parsed.authorName, parsed.authorTitle, parsed.authorUrl], ["Nguyễn Văn An", "Chuyên viên triển khai", "https://www.linkedin.com/in/an"]);
  assert.equal(adminPostInputSchema.parse({ ...postInput, authorName: null, authorTitle: null, authorUrl: null }).authorName, null);
  for (const authorUrl of ["javascript:alert(1)", "ftp://example.com/a", "khong-phai-url", "data:text/html,x"]) {
    assert.equal(adminPostInputSchema.safeParse({ ...postInput, authorUrl }).success, false, authorUrl);
  }
  assert.equal(adminPostInputSchema.safeParse({ ...postInput, authorName: "x".repeat(121) }).success, false);
  assert.equal(adminPostInputSchema.safeParse({ ...postInput, authorName: "   " }).success, false);
});

test("Bài công khai mặc định không có tác giả (null) để bài cũ và bản xem trước cũ vẫn đọc được", () => {
  const detail = { id, type: "news", title: "Bài", slug: "bai", excerpt: null, publishedAt: null, createdAt: new Date(), updatedAt: new Date(), cover: null, content: { version: 2, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung bài." }] }] } }, seoTitle: null, seoDescription: null, canonicalUrl: null };
  const parsed = publicPostDetailSchema.parse(detail);
  assert.deepEqual([parsed.authorName, parsed.authorTitle, parsed.authorUrl], [null, null, null]);
  assert.equal(publicPostDetailSchema.parse({ ...detail, authorName: "An" }).authorName, "An");
});
