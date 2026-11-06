import assert from "node:assert/strict";
import test from "node:test";

import { blockAnchor, resolveBlockFrames, sectionFrame } from "./block-layout";
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

test("Màu nền tự chọn: màu tối thì chữ trắng, khối không hợp nền tối về xanh nhạt; ảnh nền và độ rộng đi theo khung", () => {
  const text = (appearance: unknown) => block({ type: "rich_text", isEnabled: true, data: { heading: null, body: "Nội dung" }, appearance });
  const [darkFaq, lightFaq, darkText] = resolveBlockFrames([faq({ tone: "custom", backgroundColor: "#0a2a57" }), faq({ tone: "custom", backgroundColor: "#fff7ed", width: 70 }), text({ tone: "custom", backgroundColor: "#0a2a57" })]);
  assert.deepEqual([darkFaq.tone, darkFaq.background?.color], ["dark", "#0a2a57"]);
  assert.deepEqual([lightFaq.tone, lightFaq.background?.color, lightFaq.width], ["white", "#fff7ed", 70]);
  assert.deepEqual([darkText.tone, darkText.background], ["tinted", null]);
  const photo = resolveBlockFrames([faq({ tone: "tinted", backgroundMediaId: "22222222-2222-4222-8222-222222222222", backgroundOverlay: 60 })])[0];
  assert.deepEqual(photo.background, { color: null, mediaId: "22222222-2222-4222-8222-222222222222", overlay: 60 });
  assert.equal(resolveBlockFrames([faq({ tone: "custom" })])[0].background, null, "chưa chọn màu thì như Tự động");
});

test("Phần đầu trang: nền theo ô Nền của nó, chỉ màu tự chọn ở vỏ chung ghi đè; ảnh nền và độ rộng đi theo khung", () => {
  const withAppearance = (appearance: unknown) => block({ type: "hero", isEnabled: true, data: { eyebrow: null, title: "Đầu trang", description: null, primaryAction: null, secondaryAction: null }, appearance });
  const [plain, ignored] = resolveBlockFrames([hero, withAppearance({ tone: "dark", width: 80 })]);
  assert.deepEqual([plain.tone, plain.background], ["tinted", null]);
  assert.deepEqual([ignored.tone, ignored.width], ["tinted", 80], "nền Tối của vỏ chung không áp cho phần đầu trang");
  const [custom, next] = resolveBlockFrames([withAppearance({ tone: "custom", backgroundColor: "#0a2a57", backgroundMediaId: "22222222-2222-4222-8222-222222222222" }), faq()]);
  assert.deepEqual([custom.tone, custom.background?.color, custom.background?.mediaId], ["dark", "#0a2a57", "22222222-2222-4222-8222-222222222222"]);
  assert.equal(next.tone, "white", "khối sau phần đầu trang màu tối vẫn tự xen kẽ");
});

test("Khung một phần trang riêng lẻ (trang sản phẩm): tự động theo nền gợi ý, màu tối về xanh nhạt khi phần không hợp nền tối", () => {
  assert.deepEqual(sectionFrame(undefined, { fallback: "white", darkAllowed: true, spacing: "md", anchor: "bang-gia" }), { tone: "white", spacing: "md", anchor: "bang-gia", width: null, background: null });
  assert.equal(sectionFrame({ tone: "custom", backgroundColor: "#0d1b33" }, { fallback: "white", darkAllowed: false, spacing: "md" }).tone, "tinted");
  assert.deepEqual(sectionFrame({ tone: "custom", backgroundColor: "#fff7ed", spacing: "lg", width: 70 }, { fallback: "tinted", darkAllowed: true, spacing: "md" }), { tone: "white", spacing: "lg", anchor: null, width: 70, background: { color: "#fff7ed", mediaId: null, overlay: 80 } });
});
