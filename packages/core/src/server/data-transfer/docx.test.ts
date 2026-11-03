import assert from "node:assert/strict";
import test from "node:test";
import { inflateRawSync } from "node:zlib";

import type { RichDocument } from "../shared/rich-text";
import { buildDocx, richImageSources } from "./docx";

// Đọc lại các file trong .docx (zip) để kiểm XML sinh ra.
function unzip(buffer: Buffer) {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressed = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + buffer.readUInt16LE(offset + 28);
    files.set(name, inflateRawSync(buffer.subarray(start, start + compressed)));
    offset = start + compressed;
  }
  return files;
}

const text = (value: string) => ({ type: "text" as const, text: value });
const doc: RichDocument = { type: "doc", content: [
  { type: "heading", attrs: { level: 2 }, content: [text("Mục <1> & \"2\"")] },
  { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Bước ba")] }] }] },
  { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Danh sách khác")] }] }] },
  { type: "paragraph", content: [{ type: "text", text: "Liên kết", marks: [{ type: "link", attrs: { href: "https://iorder.vn/?a=1&b=2", target: null } }] }] },
  { type: "image", attrs: { src: "/media/a.png", alt: "Ảnh", title: null, width: 50, align: "center" } },
  { type: "image", attrs: { src: "/media/b.webp", alt: null, title: null, width: 100, align: "left" } },
] };

test(".docx có đủ phần bắt buộc, tiêu đề là Heading 1, H2 giữ cấp, chữ được thoát ký tự XML", () => {
  const files = unzip(buildDocx({ title: "Bài thử", summary: "Tóm tắt", doc }));
  for (const name of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/numbering.xml", "word/_rels/document.xml.rels", "docProps/core.xml"]) assert.ok(files.has(name), name);
  const document = files.get("word/document.xml")!.toString("utf8");
  assert.match(document, /<w:pStyle w:val="Heading1"\/><\/w:pPr><w:r><w:t xml:space="preserve">Bài thử<\/w:t>/);
  assert.match(document, /Heading2.*Mục &lt;1&gt; &amp; &quot;2&quot;/);
  assert.match(files.get("docProps/core.xml")!.toString("utf8"), /<dc:description>Tóm tắt<\/dc:description>/);
});

test("Mỗi danh sách số một instance riêng (bắt đầu đúng số), liên kết là quan hệ External", () => {
  const files = unzip(buildDocx({ title: "Bài", doc }));
  const numbering = files.get("word/numbering.xml")!.toString("utf8");
  assert.match(numbering, /<w:num w:numId="2"><w:abstractNumId w:val="1"\/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="3"\/>/);
  assert.match(numbering, /<w:num w:numId="3">.*<w:startOverride w:val="1"\/>/);
  assert.match(files.get("word/_rels/document.xml.rels")!.toString("utf8"), /Target="https:\/\/iorder.vn\/\?a=1&amp;b=2" TargetMode="External"/);
});

test("Ảnh đã nạp được nhúng (media + quan hệ + content type); ảnh không nạp ghi thành dòng chữ", () => {
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const files = unzip(buildDocx({ title: "Bài", doc, images: new Map([["/media/a.png", { data: png, extension: "png", width: 800, height: 600 }]]) }));
  assert.deepEqual(files.get("word/media/image1.png"), png);
  assert.match(files.get("[Content_Types].xml")!.toString("utf8"), /Extension="png" ContentType="image\/png"/);
  const document = files.get("word/document.xml")!.toString("utf8");
  // 50% bề rộng vùng chữ (6,27 inch) nhưng không lớn hơn kích thước thật 800px; tỉ lệ 4:3.
  assert.match(document, /<wp:extent cx="2866644" cy="2149983"\/>/);
  assert.match(document, /\[Ảnh — \/media\/b\.webp\]/);
  assert.deepEqual(richImageSources(doc), ["/media/a.png", "/media/b.webp"]);
});
