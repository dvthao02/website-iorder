import assert from "node:assert/strict";
import test from "node:test";
import { contentSeoSchema, isSitemapEligible } from "./content-seo";
import { builderPreviewRequestSchema } from "../publishing/builder-preview.contract";

test("SEO trống tương thích metadata cũ; noindex và loại sitemap độc lập", () => {
  assert.deepEqual(contentSeoSchema.parse({}), {});
  assert.equal(isSitemapEligible(), true);
  assert.equal(isSitemapEligible({ index: false, follow: true }), false);
  assert.equal(isSitemapEligible({ sitemap: false }), false);
  assert.equal(isSitemapEligible({ index: true, sitemap: true }), true);
});
test("SEO chỉ nhận trường định nghĩa; FAQ và giá cần đủ thông tin", () => {
  assert.equal(contentSeoSchema.safeParse({ script: "alert(1)" }).success, false);
  assert.equal(contentSeoSchema.safeParse({ structuredData: [{ type: "FAQPage" }] }).success, false);
  assert.equal(contentSeoSchema.safeParse({ structuredData: [{ type: "Product", price: 100 }] }).success, false);
  assert.ok(contentSeoSchema.safeParse({ structuredData: [{ type: "FAQPage", questions: [{ question: "Cách dùng?", answer: "Theo hướng dẫn." }] }, { type: "Product", price: 100, currency: "VND" }] }).success);
  assert.equal(contentSeoSchema.safeParse({ structuredData: [{ type: "WebPage", url: "javascript:alert(1)" }] }).success, false);
});
test("Yêu cầu preview phải có nguồn CMS chuẩn, phiên bản thứ tự và tài liệu đúng contract", () => {
  const request = { previewId: "10000000-0000-4000-8000-000000000001", documentId: null, sequence: 1, parentOrigin: "https://cms.example.com", document: { kind: "page", values: { title: "Trang thử", slug: "trang-thu", template: "default", status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null, blocks: [] } } };
  assert.ok(builderPreviewRequestSchema.safeParse(request).success);
  assert.equal(builderPreviewRequestSchema.safeParse({ ...request, sequence: 0 }).success, false);
  assert.equal(builderPreviewRequestSchema.safeParse({ ...request, parentOrigin: "https://cms.example.com/editor" }).success, false);
  assert.equal(builderPreviewRequestSchema.safeParse({ ...request, document: { kind: "post", values: {} } }).success, false);
});
