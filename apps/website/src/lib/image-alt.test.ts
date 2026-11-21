import assert from "node:assert/strict";
import { test } from "node:test";

import type { RichDocument, RichNode } from "@iorder/shared/server/shared/rich-text";
import { withImageAlts } from "./image-alt";

const text = (value: string): RichNode => ({ type: "text", text: value });
const heading = (value: string, level: 2 | 3 | 4 = 2): RichNode => ({ type: "heading", attrs: { level }, content: [text(value)] });
const image = (alt: string | null, title: string | null = null): RichNode => ({ type: "image", attrs: { src: "/a.png", alt, title, width: 100, align: "center" } });
const altsOf = (doc: RichDocument) => doc.content.flatMap((node) => node.type === "image" ? [node.attrs.alt] : []);

test("Ảnh thiếu alt lấy mô tả từ đề mục đứng trước, đánh số theo từng đề mục; alt có sẵn được giữ nguyên", () => {
  const doc: RichDocument = { type: "doc", content: [image(null), heading("Thêm món mới"), image(""), image("Màn hình thêm món"), image(null), heading("Sửa giá", 3), image(null)] };
  assert.deepEqual(altsOf(withImageAlts(doc, "Sản phẩm")), ["Sản phẩm – hình 1", "Thêm món mới – hình 1", "Màn hình thêm món", "Thêm món mới – hình 2", "Sửa giá – hình 1"]);
});

test("Chú thích ảnh được ưu tiên hơn đề mục; đề mục H4 không đổi ngữ cảnh; không ngữ cảnh thì dùng nhãn chung", () => {
  const doc: RichDocument = { type: "doc", content: [heading("Báo cáo"), image(null, "Biểu đồ doanh thu"), heading("Chi tiết", 4), image(null)] };
  assert.deepEqual(altsOf(withImageAlts(doc, "")), ["Biểu đồ doanh thu", "Báo cáo – hình 2"]);
  assert.deepEqual(altsOf(withImageAlts({ type: "doc", content: [image(null)] }, "")), ["Hình minh họa 1"]);
});

test("Số thứ tự đầu đề mục (bài nhập từ Word) không đưa vào mô tả ảnh", () => {
  const doc: RichDocument = { type: "doc", content: [heading("II. Trạng thái bàn"), image(null), heading("2) Bàn trống", 3), image(null)] };
  assert.deepEqual(altsOf(withImageAlts(doc, "Quản lý bàn")), ["Trạng thái bàn – hình 1", "Bàn trống – hình 1"]);
});

test("Ảnh nằm trong danh sách hoặc bảng cũng được bổ sung alt", () => {
  const doc: RichDocument = { type: "doc", content: [heading("Bước 1"), { type: "bulletList", content: [{ type: "listItem", content: [image(null)] }] }] };
  const list = withImageAlts(doc, "Hướng dẫn").content[1];
  assert.ok(list.type === "bulletList");
  const item = list.content?.[0];
  assert.ok(item?.type === "listItem" && item.content?.[0].type === "image" && item.content[0].attrs.alt === "Bước 1 – hình 1");
});
