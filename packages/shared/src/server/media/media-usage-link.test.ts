import assert from "node:assert/strict";
import test from "node:test";

import { mediaUsageHref } from "./media-usage-link";

const id = "6f1c2a52-8a7e-4b8e-9c0d-3f2b1a4d5e60";
const pageId = "0b9d8f3e-1c2d-4e5f-8a6b-7c8d9e0f1a2b";

test("Khối trang mở màn hình soạn của trang chứa khối, không phải mã khối", () => {
  assert.equal(mediaUsageHref({ entityType: "page_block", entityId: id, pageId }), `/admin/pages/${pageId}`);
  assert.equal(mediaUsageHref({ entityType: "page_block_content", entityId: id, pageId }), `/admin/pages/${pageId}`);
  assert.equal(mediaUsageHref({ entityType: "page_block", entityId: id }), undefined);
});

test("Ảnh SEO và trang mở thẳng màn hình soạn trang", () => {
  assert.equal(mediaUsageHref({ entityType: "page", entityId: id }), `/admin/pages/${id}`);
});

test("Bài viết mở theo loại: hướng dẫn ở mục Hướng dẫn, còn lại ở Tin tức", () => {
  assert.equal(mediaUsageHref({ entityType: "post", entityId: id, contentType: "guide" }), `/admin/guides/${id}`);
  assert.equal(mediaUsageHref({ entityType: "post", entityId: id, contentType: "news" }), `/admin/news/${id}`);
  assert.equal(mediaUsageHref({ entityType: "post_content", entityId: id, contentType: "promotion" }), `/admin/news/${id}`);
  assert.equal(mediaUsageHref({ entityType: "post", entityId: id }), `/admin/news/${id}`);
});

test("Catalog mở theo loại: sản phẩm và giải pháp có route riêng, thiếu loại thì không đoán", () => {
  assert.equal(mediaUsageHref({ entityType: "offering", entityId: id, contentType: "software" }), `/admin/products/${id}`);
  assert.equal(mediaUsageHref({ entityType: "offering", entityId: id, contentType: "solution" }), `/admin/solutions/${id}`);
  assert.equal(mediaUsageHref({ entityType: "offering", entityId: id }), undefined);
});

test("Thiết bị, nhóm thiết bị và các mục cài đặt mở đúng màn hình", () => {
  assert.equal(mediaUsageHref({ entityType: "equipment", entityId: id }), `/admin/equipment/${id}`);
  assert.equal(mediaUsageHref({ entityType: "equipment_group", entityId: id }), "/admin/equipment?tab=groups");
  assert.equal(mediaUsageHref({ entityType: "partner", entityId: id }), "/admin/partners");
  assert.equal(mediaUsageHref({ entityType: "testimonial", entityId: id }), "/admin/partners");
  assert.equal(mediaUsageHref({ entityType: "site_profile", entityId: id }), "/admin/company-profile");
  assert.equal(mediaUsageHref({ entityType: "support_download", entityId: id }), `/admin/resources/${id}`);
  assert.equal(mediaUsageHref({ entityType: "site_setting", entityId: id }), "/admin/seo");
  assert.equal(mediaUsageHref({ entityType: "user", entityId: id }), "/admin/users");
  assert.equal(mediaUsageHref({ entityType: "author", entityId: id }), "/admin/authors");
});

test("Loại không biết thì không có liên kết", () => {
  assert.equal(mediaUsageHref({ entityType: "khac", entityId: id }), undefined);
});

test("Mọi liên kết đều nằm trong CMS", () => {
  const types = ["page", "page_block", "page_block_content", "post", "post_content", "offering", "equipment", "equipment_group", "partner", "testimonial", "site_profile", "support_download", "site_setting", "user", "author"];
  for (const entityType of types) {
    const href = mediaUsageHref({ entityType, entityId: id, pageId, contentType: entityType === "offering" ? "software" : undefined });
    assert.match(href ?? "", /^\/admin(\/|$)/, entityType);
  }
});
