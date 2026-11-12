import assert from "node:assert/strict";
import test from "node:test";
import { crc32, inflateRawSync } from "node:zlib";

import { buildXlsx, excelSerialDate } from "./xlsx";

// Đọc lại zip qua central directory để kiểm cấu trúc, CRC và nội dung từng file.
function unzip(buffer: Buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let pointer = buffer.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let index = 0; index < count; index++) {
    assert.equal(buffer.readUInt32LE(pointer), 0x02014b50);
    const crc = buffer.readUInt32LE(pointer + 16);
    const size = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const offset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(offset + 26);
    const data = inflateRawSync(buffer.subarray(offset + 30 + localNameLength, offset + 30 + localNameLength + size));
    assert.equal(crc32(data), crc, name);
    files.set(name, data.toString("utf8"));
    pointer += 46 + nameLength;
  }
  return files;
}

test("xlsx có đủ các phần bắt buộc, CRC đúng và giữ tiếng Việt", () => {
  const files = unzip(buildXlsx("Khách hàng", [{ header: "Họ tên", width: 20 }, { header: "Điện thoại" }, { header: "Gửi lúc" }, { header: "Số" }], [
    ["Nguyễn Văn Á & <Co>", "+84901234567", new Date("2026-10-17T03:00:00Z"), 3],
    ["=HYPERLINK(\"x\")", null, null, undefined],
  ]));
  assert.deepEqual([...files.keys()].sort(), ["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
  const sheet = files.get("xl/worksheets/sheet1.xml")!;
  assert.match(sheet, /<t xml:space="preserve">Nguyễn Văn Á &amp; &lt;Co&gt;<\/t>/);
  // Số điện thoại và chuỗi giống công thức đều là chữ, không phải công thức.
  assert.match(sheet, /t="inlineStr"><is><t xml:space="preserve">\+84901234567<\/t>/);
  assert.match(sheet, /<t xml:space="preserve">=HYPERLINK\(&quot;x&quot;\)<\/t>/);
  assert.ok(!sheet.includes("<f>"));
  assert.match(sheet, /<c r="C2" s="2"><v>46312\.4166666/);
  assert.match(sheet, /<c r="D2"><v>3<\/v><\/c>/);
  assert.match(sheet, /<autoFilter ref="A1:D3"\/>/);
  assert.match(files.get("xl/workbook.xml")!, /<sheet name="Khách hàng"/);
});

test("ngày theo giờ Việt Nam và ký tự điều khiển bị loại khỏi XML", () => {
  // 17/10/2026 10:00 giờ Việt Nam = 03:00 UTC → phần thập phân là 10/24.
  assert.equal(excelSerialDate(new Date("2026-10-17T03:00:00Z")).toFixed(6), (46312 + 10 / 24).toFixed(6));
  const sheet = unzip(buildXlsx("S", [{ header: "A" }], [["a\u0000b\u0007c\nd"]])).get("xl/worksheets/sheet1.xml")!;
  assert.match(sheet, /<t xml:space="preserve">abc\nd<\/t>/);
});
