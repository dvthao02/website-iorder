import { inflateRawSync } from "node:zlib";

// Đọc/ghi bảng cho xuất/nhập dữ liệu, không thêm thư viện: CSV (RFC 4180) và .xlsx (zip chứa XML).
// Bộ ghi .xlsx dùng chung với xuất khách hàng tiềm năng (shared/xlsx.ts); ở đây chỉ cần bộ đọc.

export type TabularCell = string | number | null | undefined;

// File nhập do người vận hành sửa tay: đủ cho vài nghìn dòng, chặn file lớn bất thường.
export const maxImportBytes = 2 * 1024 * 1024;
export const maxImportRows = 2000;
// Tổng dữ liệu giải nén của .xlsx: chặn zip bomb (vài KB nén thành hàng GB).
const maxXlsxUncompressedBytes = 30 * 1024 * 1024;

export class TabularFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TabularFileError";
  }
}

// ---------- CSV ----------

// Ô bắt đầu bằng = + - @ (kể cả sau khoảng trắng) bị Excel hiểu là công thức: thêm ' để chỉ hiện như chữ.
function csvCell(value: TabularCell) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value);
  const safe = typeof value === "string" && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV cho Excel: BOM để mở đúng tiếng Việt, xuống dòng CRLF. */
export function buildCsv(headers: readonly string[], rows: readonly TabularCell[][]) {
  const lines = [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Đọc CSV (dấu phẩy hoặc chấm phẩy — Excel tiếng Việt lưu bằng ";"), có ô trong ngoặc kép nhiều dòng. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new TabularFileError("File CSV có ô mở ngoặc kép mà không đóng.");
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  // Bỏ dấu ' mà bản xuất CSV thêm trước giá trị giống công thức.
  return rows.map((cells) => cells.map((value) => value.replace(/^'(?=[\s]*[=+\-@])/, "")));
}

// ---------- XLSX ----------

type ZipEntry = { name: string; method: number; compressedSize: number; uncompressedSize: number; localOffset: number };

function zipEntries(buffer: Buffer): Map<string, ZipEntry> {
  // End of central directory nằm trong 64 KB cuối (comment tối đa 65535 byte).
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new TabularFileError("File .xlsx bị hỏng hoặc không phải file Excel.");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw new TabularFileError("File .xlsx bị hỏng (mục lục zip không hợp lệ).");
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, { name, method: buffer.readUInt16LE(offset + 10), compressedSize: buffer.readUInt32LE(offset + 20), uncompressedSize: buffer.readUInt32LE(offset + 24), localOffset: buffer.readUInt32LE(offset + 42) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry, budget: { left: number }) {
  const local = entry.localOffset;
  if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) throw new TabularFileError("File .xlsx bị hỏng.");
  const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
  const data = buffer.subarray(start, start + entry.compressedSize);
  if (budget.left <= 0) throw new TabularFileError("File .xlsx quá lớn sau khi giải nén.");
  let output: Buffer;
  try {
    output = entry.method === 0 ? Buffer.from(data) : entry.method === 8 ? inflateRawSync(data, { maxOutputLength: budget.left }) : (() => { throw new TabularFileError("File .xlsx dùng kiểu nén không hỗ trợ."); })();
  } catch (error) {
    if (error instanceof TabularFileError) throw error;
    throw new TabularFileError("File .xlsx quá lớn sau khi giải nén hoặc bị hỏng.");
  }
  budget.left -= output.length;
  return output.toString("utf8");
}

function decodeXml(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "amp") return "&";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const code = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : match;
  });
}

// Chữ của một ô/chuỗi dùng chung: nối mọi <t> (kể cả rich text nhiều đoạn <r><t>), bỏ phiên âm <rPh>.
function textOf(xml: string) {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
}

function columnIndex(ref: string) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

/** Đọc sheet đầu tiên của .xlsx thành bảng chữ (số giữ nguyên dạng Excel lưu, ví dụ "8900000"). */
export function readXlsx(buffer: Buffer): string[][] {
  const entries = zipEntries(buffer);
  const budget = { left: maxXlsxUncompressedBytes };
  const read = (name: string) => { const entry = entries.get(name); return entry ? readZipEntry(buffer, entry, budget) : undefined; };
  const workbook = read("xl/workbook.xml");
  if (!workbook) throw new TabularFileError("File .xlsx không có workbook.");
  const firstSheetId = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const rels = read("xl/_rels/workbook.xml.rels") ?? "";
  const target = firstSheetId ? new RegExp(`<Relationship\\b[^>]*Id="${firstSheetId}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstSheetId}"`).exec(rels)?.[1] : undefined;
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`).replace(/\/\.\//g, "/") : "xl/worksheets/sheet1.xml";
  const sheet = read(sheetPath);
  if (!sheet) throw new TabularFileError("Không đọc được sheet đầu tiên của file .xlsx.");
  const sharedXml = read("xl/sharedStrings.xml");
  const shared = sharedXml ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1])) : [];

  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const attributes = rowMatch[1] ?? rowMatch[3] ?? "";
    const rowNumber = Number(/\br="(\d+)"/.exec(attributes)?.[1] ?? rows.length + 1);
    if (rowNumber > maxImportRows + 1) throw new TabularFileError(`File có quá ${maxImportRows} dòng dữ liệu; hãy chia nhỏ file.`);
    const cells: string[] = [];
    for (const cellMatch of (rowMatch[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const cellAttributes = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(cellAttributes)?.[1];
      const type = /\bt="([^"]+)"/.exec(cellAttributes)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const value = type === "s" ? shared[Number(raw)] ?? ""
        : type === "inlineStr" ? textOf(body)
        : type === "b" ? (raw === "1" ? "TRUE" : "FALSE")
        : raw === undefined ? "" : decodeXml(raw);
      const index = ref ? columnIndex(ref) : cells.length;
      while (cells.length < index) cells.push("");
      cells[index] = value;
    }
    while (rows.length < rowNumber - 1) rows.push([]);
    rows[rowNumber - 1] = cells;
  }
  return rows;
}

/** Đọc file nhập (.xlsx hoặc .csv) thành bảng chữ; dòng đầu là tiêu đề cột. */
export function readTable(file: { name: string; bytes: Buffer }): string[][] {
  if (!file.bytes.length) throw new TabularFileError("File rỗng.");
  if (file.bytes.length > maxImportBytes) throw new TabularFileError(`File lớn hơn ${maxImportBytes / 1024 / 1024} MB; hãy chia nhỏ file.`);
  const isZip = file.bytes.length >= 4 && file.bytes.readUInt32LE(0) === 0x04034b50;
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "xls") throw new TabularFileError("File .xls (Excel 97–2003) không được hỗ trợ: trong Excel chọn Lưu thành → Sổ làm việc Excel (.xlsx).");
  const rows = isZip ? readXlsx(file.bytes) : extension === "xlsx" ? (() => { throw new TabularFileError("File .xlsx bị hỏng hoặc không phải file Excel."); })() : parseCsv(file.bytes.toString("utf8"));
  if (rows.length - 1 > maxImportRows) throw new TabularFileError(`File có quá ${maxImportRows} dòng dữ liệu; hãy chia nhỏ file.`);
  return rows;
}
