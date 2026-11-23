import assert from "node:assert/strict";
import test from "node:test";

import { blockAnchor } from "./block-layout";
import { defaultListingSections, legacyListingSectionsNotes, listingBaseBlockTypes, listingSectionsNote } from "./listing-sections";
import { defaultListingCollections, isListingPageSlug, listingLayoutFromBlocks, pageBlockInputSchema, pageInputSchema, type PageBlock } from "./pages.contract";

const entries = Object.entries(defaultListingSections);

// Mọi chuỗi `href` trong dữ liệu khối (thẻ, mục nhóm, bước, nút), kể cả lồng nhau.
function hrefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(hrefs);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, child]) => key === "href" && typeof child === "string" ? [child] : hrefs(child));
  return [];
}

test("Phần nội dung dựng sẵn thuộc về trang danh sách có thật (trang không có mục con) và phủ đủ ba trang", () => {
  for (const [slug] of entries) assert.ok(isListingPageSlug(slug), slug);
  for (const slug of ["listing-equipment", "listing-guides", "listing-support"]) assert.ok(defaultListingSections[slug as keyof typeof defaultListingSections]?.length, slug);
  // Trang có mục con (Phần mềm, Giải pháp, Dịch vụ) sinh từ mục con, không có nội dung viết tay ở đây.
  for (const slug of ["listing-software", "listing-solution"]) assert.ok(!(slug in defaultListingSections), slug);
});

test("Mọi phần dựng sẵn qua được schema khối trang (kể cả biểu tượng và mã neo)", () => {
  for (const [slug, blocks] of entries) {
    assert.ok(blocks && blocks.length > 0, slug);
    for (const block of blocks) {
      const result = pageBlockInputSchema.safeParse(block);
      assert.ok(result.success, `${slug}/${block.type}: ${result.success ? "" : result.error.message}`);
    }
  }
});

test("Phần dựng sẵn không thay khối đầu trang hay khối danh sách, mã neo không trùng trong một trang", () => {
  for (const [slug, blocks] of entries) {
    const parsed = (blocks ?? []).map(block => pageBlockInputSchema.parse(block) as PageBlock);
    for (const block of parsed) assert.ok(!listingBaseBlockTypes.includes(block.type), `${slug}: ${block.type}`);
    const anchors = parsed.flatMap(block => { const anchor = blockAnchor(block); return anchor ? [anchor] : []; });
    assert.equal(new Set(anchors).size, anchors.length, `${slug}: mã neo trùng ${anchors.join(", ")}`);
  }
});

test("Liên kết trong phần dựng sẵn là đường dẫn nội bộ hợp lệ, trỏ tới các route có thật", () => {
  const routes = [/^\/software(\/[a-z0-9-]+)?(#[a-z0-9-]+)?$/, /^\/solutions(\/[a-z0-9-]+)?$/, /^\/equipment(\/[a-z0-9-]+)?$/, /^\/support\/(guides|setup)(\/[a-z0-9-]+)?$/, /^\/support\/remote$/, /^\/contact$/];
  for (const [slug, blocks] of entries) {
    for (const href of hrefs(blocks)) assert.ok(routes.some(route => route.test(href)), `${slug}: ${href}`);
  }
});

test("Mỗi bước, thẻ, mục và câu hỏi có nội dung (không để trống mô tả)", () => {
  for (const [slug, blocks] of entries) {
    for (const block of (blocks ?? []).map(item => pageBlockInputSchema.parse(item) as PageBlock)) {
      if (block.type === "features" || block.type === "industries" || block.type === "process") for (const item of block.data.items) assert.ok(item.description.length >= 10, `${slug}/${block.type}: ${item.title}`);
      if (block.type === "faq") for (const item of block.data.items) assert.ok(item.answer.length >= 10 && item.question.endsWith("?"), `${slug}: ${item.question}`);
      if (block.type === "grouped_list") for (const group of block.data.groups) assert.ok(group.items.length >= 3 && group.action, `${slug}: ${group.title}`);
    }
  }
});

test("Trang Thiết bị (không có dải tư vấn tự động) có khối kêu gọi riêng", () => {
  assert.ok((defaultListingSections["listing-equipment"] ?? []).some(block => block.type === "cta"));
});

test("Ghi chú phiên bản mới khác các ghi chú cũ để lệnh seed phân biệt được bản đã thay", () => {
  assert.ok(!legacyListingSectionsNotes.includes(listingSectionsNote));
  assert.ok(listingSectionsNote.length <= 200);
});

test("Trang danh sách ghép đủ: đầu trang + danh sách + phần dựng sẵn, danh sách đứng trước các phần dựng sẵn", () => {
  for (const [slug, blocks] of entries) {
    if (!isListingPageSlug(slug)) continue;
    const page = pageInputSchema.parse({
      title: "Trang", slug, template: "listing", status: "published", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null,
      blocks: [
        { type: "hero", isEnabled: true, data: { eyebrow: null, title: "Đầu trang", description: null, primaryAction: null, secondaryAction: null } },
        ...defaultListingCollections[slug].map(data => ({ type: "collection_list", isEnabled: true, data })),
        ...(blocks ?? []),
      ],
    });
    const layout = listingLayoutFromBlocks(slug, page.blocks);
    assert.ok(layout, slug);
    assert.equal(layout.blocks[0]?.type, "collection_list", slug);
    assert.equal(layout.blocks.length, 1 + (blocks ?? []).length, slug);
  }
});
