import { zipFiles } from "../shared/xlsx";
import type { RichDocument, RichMark, RichNode } from "../shared/rich-text";
import { youtubeWatchUrl } from "../shared/youtube";

// Dựng file Word (.docx) từ nội dung bài viết, không thêm thư viện: .docx là zip chứa vài file XML (WordprocessingML).
// Quy ước để nhập lại được (mammoth): tiêu đề bài là Heading 1, H2–H4 của bài là Heading 2–4, trích dẫn dùng style "Quote".

export type DocxImage = { data: Buffer; extension: "png" | "jpeg" | "gif"; width: number | null; height: number | null };

const invalidXmlChars = /[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu;
const escapeXml = (value: string) => value.replace(invalidXmlChars, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Khổ A4, lề 2,54 cm: bề rộng vùng chữ 6,27 inch; 1 inch = 914400 EMU, ảnh 96 dpi = 9525 EMU mỗi pixel.
const contentWidthEmu = Math.round(6.27 * 914_400);
const emuPerPixel = 9525;

const childrenOf = (node: RichNode): RichNode[] => ("content" in node ? node.content : undefined) ?? [];
const colspanOf = (node: RichNode) => node.type === "tableCell" || node.type === "tableHeader" ? Math.max(1, node.attrs.colspan) : 1;

type Context = { numbering: string[]; relationships: string[]; media: [string, Buffer][]; images: Map<string, DocxImage>; drawingId: number; nextNum: number };
type Inline = { bold?: boolean };

function runProperties(marks: RichMark[] | undefined, inline: Inline) {
  const props: string[] = [];
  const types = new Set(marks?.map((mark) => mark.type));
  if (types.has("link")) props.push('<w:rStyle w:val="Hyperlink"/>');
  if (types.has("code")) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>');
  if (types.has("bold") || inline.bold) props.push("<w:b/>");
  if (types.has("italic")) props.push("<w:i/>");
  if (types.has("strike")) props.push("<w:strike/>");
  if (types.has("underline") || types.has("link")) props.push('<w:u w:val="single"/>');
  return props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
}

function textRun(text: string, marks: RichMark[] | undefined, inline: Inline) {
  return `<w:r>${runProperties(marks, inline)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function addRelationship(context: Context, type: string, target: string, external = false) {
  const id = `rId${context.relationships.length + 10}`;
  context.relationships.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${escapeXml(target)}"${external ? ' TargetMode="External"' : ""}/>`);
  return id;
}

function drawing(context: Context, image: DocxImage, alt: string, widthPercent: number) {
  context.drawingId++;
  const name = `image${context.drawingId}.${image.extension}`;
  context.media.push([`word/media/${name}`, image.data]);
  const relationship = addRelationship(context, "image", `media/${name}`);
  const natural = image.width ? image.width * emuPerPixel : contentWidthEmu;
  const cx = Math.round(Math.min(contentWidthEmu * Math.min(Math.max(widthPercent, 10), 100) / 100, natural));
  const cy = Math.round(image.width && image.height ? cx * image.height / image.width : cx * 0.75);
  const id = context.drawingId;
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Ảnh ${id}" descr="${escapeXml(alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}" descr="${escapeXml(alt)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationship}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

/** Ảnh: nhúng PNG/JPEG/GIF đã nạp; định dạng khác (WebP — Word cũ không mở được) ghi thành dòng chữ kèm đường dẫn. */
function imageParagraph(context: Context, src: string, alt: string | null, widthPercent: number, align: string) {
  const image = context.images.get(src);
  const jc = align === "left" ? "left" : align === "right" ? "right" : "center";
  if (image) return `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr>${drawing(context, image, alt ?? "", widthPercent)}</w:p>`;
  return `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr>${textRun(`[Ảnh${alt ? `: ${alt}` : ""} — ${src}]`, [{ type: "italic" }], {})}</w:p>`;
}

function inlineContent(context: Context, nodes: RichNode[] | undefined, inline: Inline): string {
  return (nodes ?? []).map((node) => {
    if (node.type === "text") {
      const link = node.marks?.find((mark): mark is Extract<RichMark, { type: "link" }> => mark.type === "link");
      const run = textRun(node.text, node.marks, inline);
      return link ? `<w:hyperlink r:id="${addRelationship(context, "hyperlink", link.attrs.href, true)}">${run}</w:hyperlink>` : run;
    }
    if (node.type === "hardBreak") return "<w:r><w:br/></w:r>";
    return "";
  }).join("");
}

function paragraph(content: string, properties = "") {
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ""}${content}</w:p>`;
}

function blocks(context: Context, nodes: RichNode[] | undefined, options: { style?: string; inline?: Inline; list?: { numId: number; level: number } } = {}): string {
  const inline = options.inline ?? {};
  return (nodes ?? []).map((node): string => {
    switch (node.type) {
      case "paragraph": {
        const style = options.style ? `<w:pStyle w:val="${options.style}"/>` : "";
        return paragraph(inlineContent(context, node.content, inline), style);
      }
      case "heading":
        return paragraph(inlineContent(context, node.content, inline), `<w:pStyle w:val="Heading${node.attrs.level}"/>`);
      case "blockquote":
        return blocks(context, node.content, { ...options, style: "Quote" });
      case "codeBlock": {
        const code = (node.content ?? []).map((child) => child.type === "text" ? child.text : "").join("");
        return code.split("\n").map((line) => paragraph(textRun(line, [{ type: "code" }], {}), '<w:pStyle w:val="Code"/>')).join("");
      }
      case "horizontalRule":
        return paragraph("", '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"/></w:pBdr>');
      case "bulletList":
      case "orderedList": {
        const level = options.list ? Math.min(options.list.level + 1, 8) : 0;
        // Mỗi danh sách đánh số một instance riêng để bắt đầu lại từ "start"; danh sách chấm dùng chung num 1.
        let numId = 1;
        if (node.type === "orderedList") {
          numId = context.nextNum++;
          context.numbering.push(`<w:num w:numId="${numId}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="${level}"><w:startOverride w:val="${Math.max(1, node.attrs.start ?? 1)}"/></w:lvlOverride></w:num>`);
        }
        return (node.content ?? []).map((item) => childrenOf(item).map((child, index) => {
          if (child.type === "paragraph") {
            const numbering = index === 0 ? `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>` : `<w:ind w:left="${720 * (level + 1)}"/>`;
            return paragraph(inlineContent(context, child.content, inline), `<w:pStyle w:val="ListParagraph"/>${numbering}`);
          }
          return blocks(context, [child], { ...options, list: { numId, level } });
        }).join("")).join("");
      }
      case "table": {
        const rows = node.content ?? [];
        const columns = Math.max(1, ...rows.map((row) => childrenOf(row).reduce((sum, cell) => sum + colspanOf(cell), 0)));
        const columnWidth = Math.floor(9026 / columns);
        const border = '<w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/>';
        const body = rows.map((row) => `<w:tr>${childrenOf(row).map((cell) => {
          const span = colspanOf(cell);
          const content = blocks(context, childrenOf(cell), { inline: { bold: cell.type === "tableHeader" } }) || paragraph("");
          return `<w:tc><w:tcPr><w:tcW w:w="${columnWidth * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}${cell.type === "tableHeader" ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : ""}</w:tcPr>${content}</w:tc>`;
        }).join("")}</w:tr>`).join("");
        return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${border}</w:tblBorders></w:tblPr><w:tblGrid>${Array.from({ length: columns }, () => `<w:gridCol w:w="${columnWidth}"/>`).join("")}</w:tblGrid>${body}</w:tbl>${paragraph("")}`;
      }
      case "image":
        return imageParagraph(context, node.attrs.src, node.attrs.alt, node.attrs.width, node.attrs.align);
      case "imageBanner":
        return imageParagraph(context, node.attrs.src, null, 100, "center") + blocks(context, node.content, options);
      // Word không phát được video nhúng: ghi một dòng liên kết tới video, căn giữa như khung video trên website.
      case "youtube": {
        const href = youtubeWatchUrl(node.attrs.videoId);
        const label = `▶ Video YouTube: ${node.attrs.caption ?? href}`;
        return paragraph(inlineContent(context, [{ type: "text", text: label, marks: [{ type: "link", attrs: { href, target: "_blank" } }] }], inline), '<w:jc w:val="center"/>');
      }
      default:
        return "";
    }
  }).join("");
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
${[1, 2, 3, 4].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${level === 1 ? 0 : 280}" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${[40, 32, 28, 24][level - 1]}"/><w:szCs w:val="${[40, 32, 28, 24][level - 1]}"/></w:rPr></w:style>`).join("")}
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="567"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="BFBFBF"/></w:pBdr></w:pPr><w:rPr><w:i/><w:color w:val="595959"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/></w:rPr></w:style></w:styles>`;

function numberingXml(extraNums: string[]) {
  const bullets = ["•", "◦", "▪"];
  const levels = (kind: "bullet" | "decimal") => Array.from({ length: 9 }, (_, level) => `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${kind === "bullet" ? "bullet" : ["decimal", "lowerLetter", "lowerRoman"][level % 3]}"/><w:lvlText w:val="${kind === "bullet" ? bullets[level % 3] : `%${level + 1}.`}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (level + 1)}" w:hanging="360"/></w:pPr></w:lvl>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels("bullet")}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels("decimal")}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${extraNums.join("")}</w:numbering>`;
}

/** File .docx cho một bài: tiêu đề (Heading 1) rồi nội dung; tóm tắt ghi vào thuộc tính tài liệu (không chen vào thân bài). */
export function buildDocx(input: { title: string; summary?: string | null; doc: RichDocument; images?: Map<string, DocxImage> }) {
  const context: Context = { numbering: [], relationships: [], media: [], images: input.images ?? new Map(), drawingId: 0, nextNum: 2 };
  const body = paragraph(textRun(input.title, undefined, {}), '<w:pStyle w:val="Heading1"/>') + blocks(context, input.doc.content);
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const extensions = [...new Set(context.media.map(([name]) => name.split(".").pop()!))];
  return zipFiles([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${extensions.map((extension) => `<Default Extension="${extension}" ContentType="image/${extension}"/>`).join("")}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(input.title)}</dc:title>${input.summary ? `<dc:description>${escapeXml(input.summary)}</dc:description>` : ""}<dc:creator>iOrder CMS</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`],
    ["word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${context.relationships.join("")}</Relationships>`],
    ["word/document.xml", document],
    ["word/styles.xml", stylesXml],
    ["word/numbering.xml", numberingXml(context.numbering)],
    ...context.media,
  ]);
}

/** Đường dẫn ảnh (src) có trong tài liệu, để nạp file ảnh trước khi dựng .docx. */
export function richImageSources(doc: RichDocument) {
  const sources = new Set<string>();
  const walk = (nodes: RichNode[] | undefined) => nodes?.forEach((node) => {
    if (node.type === "image" || node.type === "imageBanner") sources.add(node.attrs.src);
    walk(childrenOf(node));
  });
  walk(doc.content);
  return [...sources];
}
