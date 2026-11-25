import assert from "node:assert/strict";
import test from "node:test";

import { pageBlockInputSchema, type PageBlock } from "./pages.contract";
import { staticPageProfile, staticPageSectionLabels, staticPageSections } from "./static-page-layout";

const block = (input: unknown) => pageBlockInputSchema.parse(input) as PageBlock;

test("Hồ sơ trang tĩnh chỉ áp vào các trang hệ thống đã biết", () => {
  assert.equal(staticPageProfile("about"), "about");
  assert.equal(staticPageProfile("contact"), "contact");
  assert.equal(staticPageProfile("terms"), "document");
  assert.equal(staticPageProfile("custom-campaign"), "general");
  assert.equal(staticPageProfile("custom-contact", "contact"), "contact");
});

test("Điều hướng trang tĩnh bỏ phần đầu trang và khối bị ẩn, giữ mã neo đã lưu", () => {
  const blocks = [
    block({ type: "hero", isEnabled: true, data: { eyebrow: null, title: "Đầu trang", description: null, primaryAction: null, secondaryAction: null } }),
    block({ type: "faq", isEnabled: true, appearance: { anchor: "hoi-dap" }, data: { eyebrow: null, title: "Câu hỏi", items: [{ question: "Q", answer: "A" }] } }),
    block({ type: "stats", isEnabled: false, data: { eyebrow: null, title: "Không hiện", items: [{ value: "1", label: "Nhãn", note: null }] } }),
    block({ type: "rich_text", isEnabled: true, data: { heading: null, body: "Nội dung" } }),
  ];

  const result = staticPageSections(blocks);
  assert.deepEqual(result.sections.map(section => [section.id, section.label]), [["hoi-dap", "Câu hỏi"], ["phan-noi-dung-3", "Nội dung chính"]]);
  assert.deepEqual(result.sectionIds, [undefined, undefined, "phan-noi-dung-3"]);
});

test("Mã neo tự tạo không va chạm và không thay đổi JSONB của khối", () => {
  const blocks = [
    block({ type: "faq", isEnabled: true, appearance: { anchor: "phan-noi-dung-1" }, data: { eyebrow: null, title: "Câu hỏi", items: [{ question: "Q", answer: "A" }] } }),
    block({ type: "rich_text", isEnabled: true, data: { heading: "Văn bản", body: "Nội dung" } }),
  ];
  const before = structuredClone(blocks);

  const result = staticPageSections(blocks);
  assert.deepEqual(result.sections.map(section => section.id), ["phan-noi-dung-1", "phan-noi-dung-2"]);
  assert.deepEqual(blocks, before);
});

test("Tên mục dự phòng đổi được theo ngôn ngữ (website truyền fallbackLabel); có tiêu đề thì dùng tiêu đề, không truyền thì chữ tiếng Việt của CMS", () => {
  const blocks = [
    block({ type: "rich_text", isEnabled: true, data: { heading: null, body: "Nội dung" } }),
    block({ type: "faq", isEnabled: true, data: { eyebrow: null, title: "Hỏi đáp riêng", items: [{ question: "Q", answer: "A" }] } }),
    block({ type: "stats", isEnabled: true, data: { eyebrow: null, title: null, items: [{ value: "1", label: "Nhãn", note: null }] } }),
  ];
  const seen: Array<[string, string]> = [];
  const result = staticPageSections(blocks, (type, vietnamese) => { seen.push([type, vietnamese]); return `[${type}]`; });
  assert.deepEqual(result.sections.map(section => section.label), ["[rich_text]", "Hỏi đáp riêng", "[stats]"]);
  assert.deepEqual(seen, [["rich_text", "Nội dung chính"], ["stats", "Số liệu nổi bật"]], "chỉ hỏi tên dự phòng cho khối không có tiêu đề, kèm chữ gốc tiếng Việt");
  assert.deepEqual(staticPageSections(blocks).sections.map(section => section.label), ["Nội dung chính", "Hỏi đáp riêng", "Số liệu nổi bật"]);
  assert.ok(Object.keys(staticPageSectionLabels).includes("rich_text"));
});
