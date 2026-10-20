import { crc32, deflateRawSync } from "node:zlib";

// Tạo file .docx tối giản nhưng hợp lệ để thử chức năng nhập file Word (không cần Word/thư viện).
const png1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function zip(files: Array<[string, Buffer]>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBytes = Buffer.from(name);
    const compressed = deflateRawSync(data);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, compressed);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const para = (text: string, style?: string, bold = false) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const bullet = (text: string) => `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const cell = (text: string) => `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
const image = `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="952500" cy="952500"/><wp:docPr id="1" name="Anh"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="anh.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

/** title: H1 (thành tiêu đề bài khi nhập); sections: [tiêu đề H2, đoạn văn]. */
export function makeDocx(title: string, sections: Array<[string, string]>) {
  const body = [para(title, "Heading1"), ...sections.flatMap(([heading, text]) => [para(heading, "Heading2"), para(text), para("Điểm nhấn in đậm", undefined, true)]),
    bullet("Mục danh sách một"), bullet("Mục danh sách hai"),
    `<w:tbl><w:tr>${cell("Cột A")}${cell("Cột B")}</w:tr><w:tr>${cell("Giá trị 1")}${cell("Giá trị 2")}</w:tr></w:tbl>`, image].join("");
  const styles = `<w:styles ${w}><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/></w:style></w:styles>`;
  const numbering = `<w:numbering ${w}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  return zip([
    ["[Content_Types].xml", Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>')],
    ["_rels/.rels", Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')],
    ["word/_rels/document.xml.rels", Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/anh.png"/></Relationships>')],
    ["word/document.xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><w:document ${w}><w:body>${body}</w:body></w:document>`)],
    ["word/styles.xml", Buffer.from(styles)],
    ["word/numbering.xml", Buffer.from(numbering)],
    ["word/media/anh.png", png1x1],
  ]);
}
