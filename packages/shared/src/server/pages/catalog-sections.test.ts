import assert from "node:assert/strict";
import test from "node:test";

import { blockAnchor } from "./block-layout";
import { buildCatalogSections, catalogChildDescription, catalogListingTypes, catalogPaths, type CatalogChild } from "./catalog-sections";
import { catalogSectionsNote, legacyCatalogSectionsNotes, listingSectionsNote } from "./listing-sections";
import { pageBlockInputSchema, isListingPageSlug, type PageBlock } from "./pages.contract";

const cover = "9f76ca18-8c34-4d9a-8d78-7b3a1c2d4e5f";
const child = (overrides: Omit<Partial<CatalogChild>, "content"> & { content?: Partial<CatalogChild["content"]> } = {}): CatalogChild => ({
  type: "software", title: "Phần mềm A", slug: "phan-mem-a", coverMediaId: cover,
  ...overrides,
  content: { description: "Mô tả phần mềm A.", category: "Quản lý bán hàng", bestFor: "Nhà hàng, quán cà phê", features: ["Tính năng 1", "Tính năng 2"], benefits: ["Giảm thời gian thanh toán", "Kiểm soát thất thoát."], faq: [["Có dùng thử không?", "Có, 15 ngày."]], pricing: null, ...overrides.content },
});
const parse = (blocks: ReturnType<typeof buildCatalogSections>) => blocks.map(block => pageBlockInputSchema.parse(block) as PageBlock);

test("Ba trang có mục con ánh xạ đúng loại và đường dẫn công khai", () => {
  assert.deepEqual(catalogListingTypes, { "listing-software": "software", "listing-solution": "solution", "listing-service": "service" });
  for (const slug of Object.keys(catalogListingTypes)) assert.ok(isListingPageSlug(slug), slug);
  assert.deepEqual(catalogPaths, { software: "/software", solution: "/solutions", service: "/services" });
});

test("Mỗi mục con một phần hoàn chỉnh, ngang hàng, lấy tên từ tiêu đề mục con", () => {
  const children = [child(), child({ title: "Phần mềm B", slug: "phan-mem-b", content: { category: "Trạm sạc", faq: [] } }), child({ title: "Phần mềm C", slug: "phan-mem-c" })];
  const blocks = parse(buildCatalogSections(children));
  const sections = blocks.filter(block => block.type === "media_text");
  assert.equal(sections.length, 3);
  assert.deepEqual(sections.map(block => block.type === "media_text" ? block.data.title : ""), ["Phần mềm A", "Phần mềm B", "Phần mềm C"]);
  assert.deepEqual(sections.map(block => blockAnchor(block)), ["phan-mem-a", "phan-mem-b", "phan-mem-c"]);
  // Ảnh xen kẽ phải/trái, đủ cho trang đọc không đơn điệu.
  assert.deepEqual(sections.map(block => block.type === "media_text" ? block.data.layout : ""), ["image_right", "image_left", "image_right"]);
  const first = sections[0];
  assert.ok(first.type === "media_text");
  assert.equal(first.data.eyebrow, "Quản lý bán hàng");
  assert.equal(first.data.mediaId, cover);
  assert.deepEqual(first.data.bullets, ["Tính năng 1", "Tính năng 2"]);
  assert.deepEqual(first.data.primaryAction, { label: "Xem chi tiết", href: "/software/phan-mem-a" });
});

test("Mô tả gồm mô tả gốc, đối tượng phù hợp và lợi ích; không thêm gì ngoài dữ liệu mục con", () => {
  assert.equal(catalogChildDescription(child()), "Mô tả phần mềm A.\n\nPhù hợp với: nhà hàng, quán cà phê.\n\nLợi ích: giảm thời gian thanh toán, kiểm soát thất thoát.");
  assert.equal(catalogChildDescription(child({ content: { bestFor: null, benefits: [] } })), "Mô tả phần mềm A.");
});

test("Nút Xem bảng giá chỉ có khi mục con có bảng giá, trỏ tới mã neo bang-gia của trang con", () => {
  const [plain, priced] = parse(buildCatalogSections([child(), child({ slug: "phan-mem-b", title: "B", content: { pricing: { plans: [] } } })]));
  assert.ok(plain.type === "media_text" && priced.type === "media_text");
  assert.equal(plain.data.secondaryAction, null);
  assert.deepEqual(priced.data.secondaryAction, { label: "Xem bảng giá", href: "/software/phan-mem-b#bang-gia" });
});

test("Hỏi đáp gộp từ câu hỏi từng mục con, mỗi câu ghi rõ thuộc mục nào; không có câu hỏi thì không tạo khối", () => {
  const blocks = parse(buildCatalogSections([child(), child({ title: "Phần mềm B", slug: "phan-mem-b", content: { faq: [["Giá bao nhiêu?", "Xem bảng giá."]] } })]));
  const faq = blocks.find(block => block.type === "faq");
  assert.ok(faq && faq.type === "faq");
  assert.deepEqual(faq.data.items.map(item => item.question), ["Phần mềm A – Có dùng thử không?", "Phần mềm B – Giá bao nhiêu?"]);
  assert.equal(blockAnchor(faq), "hoi-dap");
  assert.ok(!buildCatalogSections([child({ content: { faq: [] } })]).some(block => block.type === "faq"));
});

test("Không có khối kêu gọi để website còn tự thêm dải tư vấn cuối trang; không có mục con thì không có khối nào", () => {
  const types = buildCatalogSections([child(), child({ slug: "b", title: "B" })]).map(block => block.type);
  assert.ok(!types.includes("cta") && !types.includes("lead_form"));
  assert.deepEqual(buildCatalogSections([]), []);
});

test("Mã neo cắt gọn theo giới hạn 60 ký tự và không kết thúc bằng gạch nối; giới hạn dữ liệu được giữ", () => {
  const long = child({ slug: `${"a".repeat(59)}-bcd` });
  const [section] = parse(buildCatalogSections([long]));
  const anchor = blockAnchor(section) ?? "";
  assert.ok(anchor.length <= 60 && !anchor.endsWith("-"));
  const many = child({ content: { features: Array.from({ length: 12 }, (_, index) => `Tính năng ${index + 1}`) } });
  const [capped] = parse(buildCatalogSections([many]));
  assert.ok(capped.type === "media_text" && capped.data.bullets.length === 8);
});

test("Mục con chưa có ảnh bìa vẫn tạo được phần (không ảnh)", () => {
  const [section] = parse(buildCatalogSections([child({ coverMediaId: null })]));
  assert.ok(section.type === "media_text" && section.data.mediaId === null);
});

test("Ghi chú phiên bản của trang có mục con khác bản cũ để lệnh seed nhận ra và thay được bản cũ", () => {
  assert.ok(!legacyCatalogSectionsNotes.includes(catalogSectionsNote));
  assert.ok(legacyCatalogSectionsNotes.includes(listingSectionsNote));
  assert.ok(catalogSectionsNote.length <= 200);
});
