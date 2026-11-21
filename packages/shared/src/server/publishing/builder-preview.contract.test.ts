import assert from "node:assert/strict";
import { test } from "node:test";

import { builderPreviewDocumentSchema } from "./builder-preview.contract";

const post = {
  type: "news", status: "draft", title: "Bài thử", slug: "bai-thu", excerpt: null, coverMediaId: null,
  content: { version: 2, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Xin chào" }] }] } },
  seoTitle: null, seoDescription: null, canonicalUrl: null, promotionStartAt: null, promotionEndAt: null,
  ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null, categoryIds: [], tagIds: [],
};

test("Xem trước trực tiếp nhận bản nháp bài viết đang soạn (tin tức và hướng dẫn)", () => {
  assert.equal(builderPreviewDocumentSchema.safeParse({ kind: "post", values: post }).success, true);
  assert.equal(builderPreviewDocumentSchema.safeParse({ kind: "post", values: { ...post, type: "guide" } }).success, true);
});

// Bài chưa có chữ nào cũng bị từ chối như lúc lưu: khung xem trực tiếp chờ người viết gõ ít nhất một dòng.
test("Bản nháp bài viết thiếu tiêu đề hoặc sai đường dẫn bị từ chối, giống lúc lưu", () => {
  assert.equal(builderPreviewDocumentSchema.safeParse({ kind: "post", values: { ...post, title: "" } }).success, false);
  assert.equal(builderPreviewDocumentSchema.safeParse({ kind: "post", values: { ...post, slug: "Có Dấu" } }).success, false);
  assert.equal(builderPreviewDocumentSchema.safeParse({ kind: "post", values: { ...post, extra: 1 } }).success, false);
  assert.equal(builderPreviewDocumentSchema.safeParse({ kind: "post", values: { ...post, content: { version: 2, doc: { type: "doc", content: [{ type: "paragraph" }] } } } }).success, false);
});
