import assert from "node:assert/strict";
import { test } from "node:test";

import type { RichDocument, RichNode } from "@iorder/shared/server/shared/rich-text";
import { articleSummary } from "./article-summary";

const text = (value: string): RichNode => ({ type: "text", text: value });
const paragraph = (value: string): RichNode => ({ type: "paragraph", content: [text(value)] });
const heading = (value: string, level: 2 | 3 = 2): RichNode => ({ type: "heading", attrs: { level }, content: [text(value)] });
const list = (...items: string[]): RichNode => ({ type: "bulletList", content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })) });
const doc = (...content: RichNode[]): RichDocument => ({ type: "doc", content });

test("Mỗi đề mục H2 cho một ý: câu đầu tiên ngay dưới đề mục, mã neo khớp mục lục", () => {
  const points = articleSummary(doc(
    paragraph("Đoạn mở đầu không thuộc đề mục nào nên không vào tóm tắt."),
    heading("Vì sao cần kết ca"), paragraph("Chia ca giúp trách nhiệm rõ ràng. Câu thứ hai không đưa vào tóm tắt."),
    heading("Quy trình kết ca"), paragraph("Đếm tiền mặt trong két rồi so với số tồn quỹ trên hệ thống."),
    heading("Cách xử lý khi tiền bị lệch"), paragraph("Đừng vội quy kết, hãy kiểm tra các khoản chi chưa ghi nhận trước."),
  ));
  assert.ok(points);
  assert.deepEqual(points.map((point) => point.text), ["Chia ca giúp trách nhiệm rõ ràng.", "Đếm tiền mặt trong két rồi so với số tồn quỹ trên hệ thống.", "Đừng vội quy kết, hãy kiểm tra các khoản chi chưa ghi nhận trước."]);
  assert.deepEqual(points.map((point) => point.id), ["vi-sao-can-ket-ca", "quy-trinh-ket-ca", "cach-xu-ly-khi-tien-bi-lech"]);
});

test("Câu đầu quá cụt thì ghép thêm câu kế tiếp để ý còn rõ nghĩa", () => {
  const points = articleSummary(doc(
    heading("Cách xử lý"), paragraph("Đừng vội quy kết. Hãy kiểm tra các khoản chi chưa ghi nhận trước tiên. Câu thứ ba bị bỏ."),
    heading("Phần hai"), paragraph("Một câu đủ dài để đứng riêng làm ý chính. Câu phụ không vào."),
    heading("Phần ba"), paragraph("Câu thứ ba cũng đủ dài để đứng riêng làm ý chính."),
  ));
  assert.ok(points);
  assert.equal(points[0].text, "Đừng vội quy kết. Hãy kiểm tra các khoản chi chưa ghi nhận trước tiên.");
  assert.equal(points[1].text, "Một câu đủ dài để đứng riêng làm ý chính.");
  // Câu kế tiếp rất dài: vẫn ghép rồi cắt ở ranh giới từ, tổng không quá 160 ký tự.
  const long = articleSummary(doc(
    heading("A"), paragraph(`Đừng vội quy kết. ${"Hãy kiểm tra các khoản chi chưa ghi nhận trước tiên ".repeat(5)}.`),
    heading("B"), paragraph("Một câu đủ dài để đứng riêng làm ý chính."), heading("C"), paragraph("Một câu đủ dài để đứng riêng làm ý chính nữa."),
  ));
  assert.ok(long && long[0].text.startsWith("Đừng vội quy kết. Hãy kiểm tra") && long[0].text.length <= 160 && long[0].text.endsWith("…"));
});

test("Đề mục kêu gọi cuối bài, đề mục H3 và đề mục không có chữ bên dưới bị bỏ; dưới 3 ý thì không tạo tóm tắt", () => {
  const points = articleSummary(doc(
    heading("Ý chính thứ nhất"), paragraph("Nội dung đủ dài để làm câu tóm tắt cho phần đầu."),
    heading("Chi tiết nhỏ", 3), paragraph("Đề mục H3 không phải một ý chính của bài viết."),
    heading("Ý chính thứ hai"), heading("Ý chính thứ ba"), paragraph("Nội dung đủ dài để làm câu tóm tắt cho phần thứ ba."),
    heading("Ý chính thứ tư"), list("Mục đầu tiên của danh sách đủ dài để làm câu tóm tắt", "Mục thứ hai"),
    heading("Bắt đầu với iOrder"), paragraph("Phần kêu gọi liên hệ không phải ý chính của bài viết này."),
    heading("Đọc thêm"), list("Một bài viết khác cùng chủ đề đủ dài để thành một câu tóm tắt"),
  ));
  assert.ok(points);
  assert.deepEqual(points.map((point) => point.heading), ["Ý chính thứ nhất", "Ý chính thứ ba", "Ý chính thứ tư"]);
  assert.equal(points[2].text, "Mục đầu tiên của danh sách đủ dài để làm câu tóm tắt");
  assert.equal(articleSummary(doc(heading("Chỉ một phần"), paragraph("Chỉ có một ý chính nên chưa đủ để thành bản tóm tắt."))), null);
});

test("Câu quá dài được cắt, tối đa 5 ý, đoạn quá ngắn bị bỏ qua để lấy đoạn kế", () => {
  const long = `${"Một câu rất dài không có dấu chấm nào cả ".repeat(8)}`.trim();
  const sections = Array.from({ length: 7 }, (_, n) => [heading(`Phần số ${n + 1}`), paragraph("Ngắn."), paragraph(n === 0 ? long : `Câu mở đầu của phần số ${n + 1} đủ dài.`)]).flat();
  const points = articleSummary(doc(...sections));
  assert.ok(points);
  assert.equal(points.length, 5);
  assert.ok(points[0].text.length <= 160 && points[0].text.endsWith("…"));
  assert.equal(points[1].text, "Câu mở đầu của phần số 2 đủ dài.");
});
