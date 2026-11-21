import assert from "node:assert/strict";
import test from "node:test";

import { builderPreviewDocumentSchema } from "@iorder/shared/server/publishing/builder-preview.contract";
import { incompleteBlockNumber, previewReadyDocument } from "./preview-document";

const richText = { type: "rich_text", isEnabled: true, data: { heading: null, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung" }] }] } } };
const emptyImage = { type: "image", isEnabled: true, data: { mediaId: "", extraMediaIds: [], alt: null, caption: null } };
const emptyVideo = { type: "video", isEnabled: true, data: { eyebrow: null, title: null, description: null, url: "", caption: null } };
const page = (blocks: unknown[]) => ({ kind: "page", values: { title: "Trang thử", slug: "trang-thu", template: "default", status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null, scheduledAt: null, blocks } });

test("Khối Hình ảnh/Video chưa điền làm tài liệu xem trước không hợp lệ, sau khi chuẩn bị thì hợp lệ", () => {
  const raw = page([richText, emptyImage, emptyVideo, richText]);
  assert.equal(builderPreviewDocumentSchema.safeParse(raw).success, false);
  const ready = previewReadyDocument(raw);
  assert.equal(builderPreviewDocumentSchema.safeParse(ready).success, true);
});

test("Khối thay thế giữ nguyên vị trí và bị ẩn, khối khác không đổi", () => {
  const ready = previewReadyDocument(page([richText, emptyImage, richText])) as ReturnType<typeof page>;
  const blocks = ready.values.blocks as Array<{ type: string; isEnabled: boolean }>;
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0], richText);
  assert.equal(blocks[2], richText);
  assert.equal(blocks[1].isEnabled, false);
});

test("Khối Hình ảnh đã chọn ảnh được giữ nguyên", () => {
  const filled = { ...emptyImage, data: { ...emptyImage.data, mediaId: "2304f978-1dd5-43ec-9e30-91db934955ff" } };
  const ready = previewReadyDocument(page([filled])) as ReturnType<typeof page>;
  assert.equal(ready.values.blocks[0], filled);
});

test("Tài liệu không có danh sách khối hoặc sai dạng được trả về nguyên vẹn", () => {
  const post = { kind: "post", values: { title: "x" } };
  assert.equal(previewReadyDocument(post), post);
  assert.equal(previewReadyDocument(null), null);
});

test("Số thứ tự thành phần chưa hoàn chỉnh lấy từ đường dẫn lỗi", () => {
  assert.equal(incompleteBlockNumber(["values", "blocks", 2, "data", "mediaId"]), 3);
  assert.equal(incompleteBlockNumber(["values", "content", "blocks", 0, "data"]), 1);
  assert.equal(incompleteBlockNumber(["values", "title"]), null);
});

const faq = (answer: string) => ({ type: "faq", isEnabled: true, data: { eyebrow: null, title: "Hỏi đáp", items: [{ question: "Câu 1", answer: "Trả lời 1" }, { question: "Câu hỏi mới", answer }] } });
const hero = (highlightTitle: string) => ({ type: "hero", isEnabled: true, data: { eyebrow: null, title: "Tiêu đề", description: null, primaryAction: null, secondaryAction: null, mediaId: null, layout: "split", highlights: [{ title: highlightTitle, note: null }], footnote: null, slides: [], extraMediaIds: [], tone: null, panels: [] } });

test("Câu hỏi vừa thêm (đáp án trống) và điểm nổi bật chưa có chữ được điền tạm trong bản xem trước, giữ nguyên vị trí", () => {
  const raw = page([hero(""), faq("")]);
  assert.equal(builderPreviewDocumentSchema.safeParse(raw).success, false);
  const ready = previewReadyDocument(raw) as ReturnType<typeof page>;
  assert.equal(builderPreviewDocumentSchema.safeParse(ready).success, true);
  const [heroBlock, faqBlock] = ready.values.blocks as Array<{ data: { highlights?: Array<{ title: string }>; items?: Array<{ answer: string; question: string }> } }>;
  assert.equal(heroBlock.data.highlights?.[0].title, "…");
  assert.equal(faqBlock.data.items?.[0].answer, "Trả lời 1");
  assert.equal(faqBlock.data.items?.[1].answer, "…");
});

test("Bản xem trước không làm đổi dữ liệu đang nhập trong form", () => {
  const raw = page([faq("")]);
  const before = JSON.stringify(raw);
  previewReadyDocument(raw);
  assert.equal(JSON.stringify(raw), before);
});

test("Lỗi không phải ô chữ trống (sai định dạng) vẫn giữ nguyên để canvas báo chưa đủ thông tin", () => {
  const bad = { ...hero("Ý nổi bật"), data: { ...hero("Ý nổi bật").data, layout: "zigzag" } };
  const raw = page([bad]);
  const ready = previewReadyDocument(raw);
  assert.equal(builderPreviewDocumentSchema.safeParse(ready).success, false);
});
