import { crc32, deflateRawSync } from "node:zlib";

// Bộ tạo .xlsx tối giản (một sheet) không cần thư viện ngoài: file xlsx là zip chứa vài file XML.
// Chuỗi ghi dạng inlineStr nên Excel không bao giờ hiểu là công thức (không có rủi ro CSV injection),
// ngày ghi dạng số serial của Excel theo giờ Việt Nam để lọc/sắp xếp được.

export type XlsxCell = string | number | Date | null | undefined;
export type XlsxColumn = { header: string; width?: number };

const vietnamOffsetMs = 7 * 60 * 60 * 1000;
// Bỏ ký tự điều khiển XML 1.0 không cho phép (giữ tab, xuống dòng).
const invalidXmlChars = /[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu;

function escapeXml(value: string) {
  return value.replace(invalidXmlChars, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

export function excelSerialDate(date: Date) {
  return (date.getTime() + vietnamOffsetMs) / 86_400_000 + 25_569;
}

function cellXml(value: XlsxCell, ref: string, header: boolean) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return `<c r="${ref}" s="2"><v>${excelSerialDate(value)}</v></c>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
  const text = escapeXml(String(value).slice(0, 32_767));
  return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ""}><is><t xml:space="preserve">${text}</t></is></c>`;
}

function sheetXml(columns: XlsxColumn[], rows: XlsxCell[][]) {
  const lastColumn = columnName(Math.max(columns.length, 1) - 1);
  const lastRow = rows.length + 1;
  const cols = columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 18}" customWidth="1"/>`).join("");
  const header = `<row r="1">${columns.map((column, index) => cellXml(column.header, `${columnName(index)}1`, true)).join("")}</row>`;
  const body = rows.map((row, rowIndex) => `<row r="${rowIndex + 2}">${row.map((value, index) => cellXml(value, `${columnName(index)}${rowIndex + 2}`, false)).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${header}${body}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`;
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF3F8"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function workbookFiles(sheetName: string, columns: XlsxColumn[], rows: XlsxCell[][]): [string, string][] {
  const name = escapeXml(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1");
  return [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${name.replace(/'/g, "''")}'!$A$1:$${columnName(Math.max(columns.length, 1) - 1)}$${rows.length + 1}</definedName></definedNames></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", stylesXml],
    ["xl/worksheets/sheet1.xml", sheetXml(columns, rows)],
  ];
}

// Zip chuẩn (deflate) với local header, central directory và end record; đủ cho Excel/LibreOffice/Google Sheets.
function zip(files: [string, string][]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const compressed = deflateRawSync(data);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, compressed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export function buildXlsx(sheetName: string, columns: XlsxColumn[], rows: XlsxCell[][]) {
  return zip(workbookFiles(sheetName, columns, rows));
}
