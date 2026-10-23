import assert from "node:assert/strict";
import test from "node:test";

import { blockAnchor, resolveBlockFrames } from "./block-layout";
import { pageBlockInputSchema, type PageBlock } from "./pages.contract";

const block = (input: unknown) => pageBlockInputSchema.parse(input) as PageBlock;
const hero = block({ type: "hero", isEnabled: true, data: { eyebrow: null, title: "Đầu trang", description: null, primaryAction: null, secondaryAction: null } });
const faq = (appearance?: unknown) => block({ type: "faq", isEnabled: true, data: { eyebrow: null, title: "Hỏi đáp", items: [{ question: "Q", answer: "A" }] }, ...(appearance ? { appearance } : {}) });
const stats = block({ type: "stats", isEnabled: true, data: { eyebrow: null, title: null, items: [{ value: "1", label: "Nhãn", note: null }] } });
const partners = block({ type: "partners", isEnabled: true, data: { eyebrow: null, title: "Đối tác", kind: "all", limit: 6 } });

test("Nền tự động xen kẽ trắng / xanh nhạt, bắt đầu khác phần đầu trang", () => {
  // Phần đầu trang mặc định nền xanh nhạt → khối kế tiếp nền trắng.
  assert.deepEqual(resolveBlockFrames([hero, faq(), faq(), faq()]).map(frame => frame.tone), ["tinted", "white", "tinted", "white"]);
  assert.deepEqual(resolveBlockFrames([faq(), faq()]).map(frame => frame.tone), ["white", "tinted"]);
  assert.deepEqual(resolveBlockFrames([faq()], "white").map(frame => frame.tone), ["tinted"]);
});

test("Nền chọn tay và nền riêng của khối được giữ, khối sau vẫn khác khối trước", () => {
  assert.deepEqual(resolveBlockFrames([faq(), stats, faq(), faq({ tone: "white" }), faq()]).map(frame => frame.tone), ["white", "dark", "white", "white", "tinted"]);
});

test("Nền tối chỉ áp cho khối dạng thẻ", () => {
  const text = block({ type: "rich_text", isEnabled: true, data: { heading: null, body: "Nội dung" }, appearance: { tone: "dark" } });
  assert.deepEqual(resolveBlockFrames([faq({ tone: "dark" }), text]).map(frame => frame.tone), ["dark", "tinted"]);
});

test("Khoảng cách mặc định theo loại khối, ghi đè được", () => {
  assert.deepEqual(resolveBlockFrames([faq(), partners, faq({ spacing: "lg" })]).map(frame => frame.spacing), ["md", "sm", "lg"]);
});

test("Mã neo lấy từ vỏ chung trước, rồi trường cũ", () => {
  assert.equal(blockAnchor(faq({ anchor: "hoi-dap" })), "hoi-dap");
  assert.equal(blockAnchor(block({ type: "cta", isEnabled: true, data: { id: "tu-van", eyebrow: null, title: "A", action: { label: "B", href: "/" } } })), "tu-van");
  assert.equal(blockAnchor(block({ type: "collection_list", isEnabled: true, data: { source: "posts", eyebrow: null, title: null, description: null, limit: null, anchor: "tin" }, appearance: { anchor: "moi" } })), "moi");
  assert.equal(pageBlockInputSchema.safeParse({ type: "faq", isEnabled: true, data: { eyebrow: null, title: "A", items: [{ question: "Q", answer: "A" }] }, appearance: { anchor: "Có dấu" } }).success, false);
});
