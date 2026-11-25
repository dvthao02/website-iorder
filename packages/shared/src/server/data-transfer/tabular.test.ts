import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

import { buildXlsx, zipFiles } from "../shared/xlsx";
import { buildCsv, listTableSheets, maxImportBytes, parseCsv, readTable, readXlsx, TabularFileError } from "./tabular";

test("chọn đúng sheet theo tên, kể cả tên có ký tự XML", () => {
  const bytes = zipFiles([
    ["xl/workbook.xml", '<workbook><sheets><sheet name="Thiết bị" r:id="rId1"/><sheet name="Phụ kiện &amp; giấy" r:id="rId2"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Target="worksheets/sheet2.xml" Id="rId2"/></Relationships>'],
    ["xl/worksheets/sheet1.xml", '<worksheet><row r="1"><c r="A1" t="inlineStr"><is><t>Đầu</t></is></c></row></worksheet>'],
    ["xl/worksheets/sheet2.xml", '<worksheet><row r="1"><c r="A1" t="inlineStr"><is><t>Sau</t></is></c></row></worksheet>'],
  ]);
  const file = { name: "data.xlsx", bytes };
  assert.deepEqual(listTableSheets(file), ["Thiết bị", "Phụ kiện & giấy"]);
  assert.deepEqual(readTable({ ...file, sheetName: "Phụ kiện & giấy" }), [["Sau"]]);
  assert.throws(() => readTable({ ...file, sheetName: "Không có" }), /Không tìm thấy sheet/);
  assert.deepEqual(listTableSheets({ name: "data.csv", bytes: Buffer.from("a,b\n1,2") }), []);
});

test("xlsx ghi ra rồi đọc lại giữ đúng chữ tiếng Việt, số, ô trống và ký tự đặc biệt", () => {
  const rows = [["may-in-80mm", "Máy in hóa đơn <80mm> & \"két\"", 1_650_000, null, "Dòng 1\nDòng 2"], ["ket", "Két đựng tiền", 850_000, "CD-405", "=SUM(A1)"]];
  const table = readXlsx(buildXlsx("Thiết bị", [{ header: "Đường dẫn (slug)" }, { header: "Tên" }, { header: "Giá (VNĐ)" }, { header: "Model" }, { header: "Tóm tắt" }], rows));
  assert.deepEqual(table[0], ["Đường dẫn (slug)", "Tên", "Giá (VNĐ)", "Model", "Tóm tắt"]);
  assert.deepEqual(table[1], ["may-in-80mm", "Máy in hóa đơn <80mm> & \"két\"", "1650000", "", "Dòng 1\nDòng 2"]);
  // Chuỗi giống công thức được ghi là chữ (inlineStr), đọc lại nguyên văn.
  assert.deepEqual(table[2], ["ket", "Két đựng tiền", "850000", "CD-405", "=SUM(A1)"]);
});

test("CSV ghi/đọc khứ hồi: BOM, ngoặc kép, xuống dòng trong ô, dấu ' chống công thức được bỏ khi đọc", () => {
  const csv = buildCsv(["slug", "Tên", "Ghi chú"], [["a", "Máy \"POS\", mini", "dòng 1\r\ndòng 2"], ["b", "-giảm giá", null]]);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes("'-giảm giá"));
  assert.deepEqual(parseCsv(csv), [["slug", "Tên", "Ghi chú"], ["a", "Máy \"POS\", mini", "dòng 1\r\ndòng 2"], ["b", "-giảm giá", ""]]);
});

test("CSV chấm phẩy (Excel tiếng Việt) được nhận đúng; ngoặc kép không đóng báo lỗi", () => {
  assert.deepEqual(parseCsv("slug;Giá (VNĐ)\nmay-in;1.650.000\n"), [["slug", "Giá (VNĐ)"], ["may-in", "1.650.000"]]);
  assert.throws(() => parseCsv("slug,Tên\na,\"chưa đóng\n"), TabularFileError);
});

test("readTable: chặn file rỗng, quá lớn, .xls cũ và zip hỏng", () => {
  assert.throws(() => readTable({ name: "a.csv", bytes: Buffer.alloc(0) }), TabularFileError);
  assert.throws(() => readTable({ name: "a.csv", bytes: Buffer.alloc(maxImportBytes + 1, 65) }), TabularFileError);
  assert.throws(() => readTable({ name: "a.xls", bytes: Buffer.from("abc") }), /\.xls/);
  assert.throws(() => readTable({ name: "a.xlsx", bytes: Buffer.from("PK\u0003\u0004 hỏng") }), TabularFileError);
});

test("xlsx bị nén bất thường (zip bomb) bị chặn thay vì giải nén hết vào RAM", () => {
  const huge = "<x/>".repeat(10_000_000);
  const compressed = deflateRawSync(Buffer.from(huge));
  assert.ok(compressed.length < 200_000);
  // Zip một mục, khai sai kích thước giải nén nhỏ để thử giới hạn thực tế khi inflate.
  const name = Buffer.from("xl/workbook.xml");
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(10, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(10, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(30 + name.length + compressed.length, 16);
  const zip = Buffer.concat([local, name, compressed, central, name, end]);
  assert.throws(() => readXlsx(zip), /quá lớn/);
});

test("xlsx do Open XML SDK ghi (mọi thẻ có tiền tố x:, rels mở đầu bằng BOM, ô t=\"str\") vẫn đọc được: tên sheet, chữ tiếng Việt, ô công thức chữ", () => {
  const main = 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const bytes = zipFiles([
    ["xl/workbook.xml", `<?xml version="1.0" encoding="utf-8"?><x:workbook ${main}><x:sheets><x:sheet name="Bản dịch" sheetId="1" r:id="Rabc" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" /></x:sheets></x:workbook>`],
    ["xl/_rels/workbook.xml.rels", '﻿<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml" Id="Rabc" /></Relationships>'],
    ["xl/sharedStrings.xml", `<?xml version="1.0" encoding="utf-8"?><x:sst ${main} />`],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="utf-8"?><x:worksheet ${main}><x:sheetData>`
      + '<x:row r="1"><x:c r="A1" s="1" t="inlineStr"><x:is><x:t xml:space="preserve">Khóa</x:t></x:is></x:c><x:c r="B1" t="inlineStr"><x:is><x:t>Tiếng Việt</x:t></x:is></x:c><x:c r="C1" t="inlineStr"><x:is><x:t>en · English</x:t></x:is></x:c></x:row>'
      + '<x:row r="2"><x:c r="A2" t="inlineStr"><x:is><x:t>ui.header.openMenu</x:t></x:is></x:c><x:c r="B2" t="inlineStr"><x:is><x:t>Mở menu</x:t></x:is></x:c><x:c r="C2" t="str"><x:v>Open menu</x:v></x:c></x:row>'
      + "</x:sheetData></x:worksheet>"],
  ]);
  const file = { name: "ban-dich.xlsx", bytes };
  assert.deepEqual(listTableSheets(file), ["Bản dịch"]);
  assert.deepEqual(readTable(file), [["Khóa", "Tiếng Việt", "en · English"], ["ui.header.openMenu", "Mở menu", "Open menu"]]);
  assert.deepEqual(readTable({ ...file, sheetName: "Bản dịch" })[1], ["ui.header.openMenu", "Mở menu", "Open menu"]);
});
