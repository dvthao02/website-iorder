import assert from "node:assert/strict";
import test from "node:test";

import { richDocumentSchema, richFirstParagraph, richPlainText, richTableOfContents, sanitizeRichDocument } from "./rich-text";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (text: string, marks?: unknown[]) => ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });

test("giữ định dạng hợp lệ, bỏ thuộc tính lạ của Tiptap", () => {
  const result = sanitizeRichDocument(doc(
    { type: "heading", attrs: { level: 2, textAlign: "left" }, content: [{ type: "text", text: "Bước 1" }] },
    p("Xem tại đây", [{ type: "bold" }, { type: "link", attrs: { href: "https://iorder.vn", target: "_blank", rel: "noopener", class: "x" } }]),
    { type: "image", attrs: { src: "/media/2026/10/a.png", alt: "Ảnh", width: 300 } },
    { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: [100] }, content: [p("Ô")] }] }] },
  ));
  assert.deepEqual(result.content[0], { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Bước 1" }] });
  assert.deepEqual(result.content[1], { type: "paragraph", content: [{ type: "text", text: "Xem tại đây", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://iorder.vn", target: "_blank" } }] }] });
  assert.deepEqual(result.content[2], { type: "image", attrs: { src: "/media/2026/10/a.png", alt: "Ảnh", title: null, width: 100, align: "center" } });
});

test("từ chối liên kết javascript:, ảnh ngoài thư viện, thành phần lạ và nội dung trống", () => {
  const bad = [
    doc(p("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
    doc(p("x", [{ type: "link", attrs: { href: "//evil.example" } }])),
    doc({ type: "image", attrs: { src: "https://evil.example/a.png" } }),
    doc({ type: "iframe", attrs: { src: "https://x" } }),
    doc(p("x", [{ type: "textStyle", attrs: { color: "red" } }])),
    doc({ type: "paragraph" }),
    { type: "notdoc", content: [] },
  ];
  for (const value of bad) assert.equal(richDocumentSchema.safeParse(value).success, false, JSON.stringify(value));
  assert.equal(sanitizeRichDocument(doc({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "H1" }] })).content[0].type, "heading");
  assert.deepEqual((sanitizeRichDocument(doc({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "H1" }] })).content[0] as { attrs: unknown }).attrs, { level: 2 });
});

test("mục lục từ H2/H3 với id không trùng; chữ thuần và đoạn đầu", () => {
  const value = sanitizeRichDocument(doc(
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Cài đặt" }] },
    p("Đoạn đầu tiên."),
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Cài đặt" }] },
    { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Bỏ qua H4" }] },
  ));
  assert.deepEqual(richTableOfContents(value), [{ id: "cai-dat", text: "Cài đặt", level: 2 }, { id: "cai-dat-2", text: "Cài đặt", level: 3 }]);
  assert.equal(richFirstParagraph(value), "Đoạn đầu tiên.");
  assert.equal(richPlainText(value), "Cài đặt Đoạn đầu tiên. Cài đặt Bỏ qua H4");
});

test("chữ thuần cũ chuyển thành đoạn văn, giữ xuống dòng", async () => {
  const { plainTextToRichDocument } = await import("./rich-text");
  assert.deepEqual(plainTextToRichDocument("Dòng 1\nDòng 2\n\nĐoạn 2"), { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Dòng 1" }, { type: "hardBreak" }, { type: "text", text: "Dòng 2" }] },
    { type: "paragraph", content: [{ type: "text", text: "Đoạn 2" }] },
  ] });
});

test("ảnh có độ rộng %/căn lề; khối ảnh nền chỉ chứa chữ", () => {
  const value = sanitizeRichDocument(doc(
    { type: "image", attrs: { src: "/media/a.png", width: 47, align: "left" } },
    { type: "image", attrs: { src: "/media/b.png", width: 400, align: "top" } },
    { type: "image", attrs: { src: "/media/c.png", size: "medium" } },
    { type: "imageBanner", attrs: { src: "/media/nen.jpg", overlay: "light", height: "tall" }, content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Tiêu đề trên ảnh" }] }, p("Chữ trên ảnh")] },
  ));
  assert.deepEqual((value.content[0] as { attrs: unknown }).attrs, { src: "/media/a.png", alt: null, title: null, width: 47, align: "left" });
  assert.equal((value.content[1] as { attrs: { width: number } }).attrs.width, 100);
  assert.equal((value.content[1] as { attrs: { align: string } }).attrs.align, "center");
  assert.equal((value.content[2] as { attrs: { width: number } }).attrs.width, 50);
  assert.deepEqual((value.content[3] as { attrs: unknown }).attrs, { src: "/media/nen.jpg", overlay: "light", height: "tall" });
  for (const bad of [
    doc({ type: "imageBanner", attrs: { src: "https://evil.example/a.jpg" }, content: [p("x")] }),
    doc({ type: "imageBanner", attrs: { src: "/media/a.jpg" }, content: [{ type: "image", attrs: { src: "/media/b.png" } }] }),
    doc({ type: "imageBanner", attrs: { src: "/media/a.jpg" }, content: [{ type: "table", content: [] }] }),
  ]) assert.equal(richDocumentSchema.safeParse(bad).success, false);
});
