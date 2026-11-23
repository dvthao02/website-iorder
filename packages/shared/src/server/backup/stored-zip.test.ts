import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { crc32 } from "node:zlib";

import { createStoredZip } from "./stored-zip";

// Bộ đọc .zip tối thiểu theo central directory (cách Explorer, 7-Zip, unzip đọc) để kiểm tra gói tự ghi.
function readZip(zip: Buffer) {
  const endAt = zip.length - 22;
  assert.equal(zip.readUInt32LE(endAt), 0x06054b50, "end of central directory ở cuối gói");
  const count = zip.readUInt16LE(endAt + 10);
  const directoryAt = zip.readUInt32LE(endAt + 16);
  assert.equal(directoryAt + zip.readUInt32LE(endAt + 12), endAt, "central directory liền ngay trước end record");
  const files = new Map<string, Buffer>();
  let cursor = directoryAt;
  for (let index = 0; index < count; index++) {
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50);
    const method = zip.readUInt16LE(cursor + 10), checksum = zip.readUInt32LE(cursor + 16), size = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28), localAt = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    assert.equal(method, 0, "không nén");
    assert.equal(zip.readUInt32LE(localAt), 0x04034b50);
    assert.equal(zip.readUInt32LE(localAt + 14), checksum, "CRC trong local header khớp central directory");
    const dataAt = localAt + 30 + zip.readUInt16LE(localAt + 26) + zip.readUInt16LE(localAt + 28);
    const data = zip.subarray(dataAt, dataAt + size);
    assert.equal(crc32(data), checksum, `CRC của ${name}`);
    files.set(name, Buffer.from(data));
    cursor += 46 + nameLength;
  }
  return files;
}

async function collect(stream: AsyncIterable<Buffer>) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("Gói .zip phát từ đĩa đọc lại được đúng tên, đúng nội dung, đúng CRC và đúng kích thước đã báo", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "iorder-zip-"));
  try {
    const dump = randomBytes(300_000);
    await writeFile(path.join(folder, "iorder_v2.dump"), dump);
    await writeFile(path.join(folder, "SHA256SUMS"), "abc  ./iorder_v2.dump\n");
    await writeFile(path.join(folder, "rong.dump"), "");
    const zip = await createStoredZip([
      { name: "iorder_v2.dump", file: path.join(folder, "iorder_v2.dump") },
      { name: "SHA256SUMS", file: path.join(folder, "SHA256SUMS") },
      { name: "rong.dump", file: path.join(folder, "rong.dump") },
    ], new Date("2026-11-22T10:00:00Z"));
    const bytes = await collect(zip.stream());
    assert.equal(bytes.length, zip.size, "Content-Length báo đúng");
    const files = readZip(bytes);
    assert.deepEqual([...files.keys()], ["iorder_v2.dump", "SHA256SUMS", "rong.dump"]);
    assert.ok(files.get("iorder_v2.dump")!.equals(dump));
    assert.equal(files.get("SHA256SUMS")!.toString(), "abc  ./iorder_v2.dump\n");
    assert.equal(files.get("rong.dump")!.length, 0);
    // Gọi stream() lần nữa vẫn ra cùng nội dung (mỗi lượt tải một luồng mới).
    assert.ok((await collect(zip.stream())).equals(bytes));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("Tệp đổi kích thước giữa hai lượt đọc làm luồng báo lỗi thay vì trả gói sai", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "iorder-zip-"));
  try {
    const file = path.join(folder, "a.dump");
    await writeFile(file, "một hai ba");
    const zip = await createStoredZip([{ name: "a.dump", file }]);
    await writeFile(file, "ngắn");
    await assert.rejects(collect(zip.stream()), /thay đổi trong lúc đóng gói/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("Tệp không tồn tại thì không tạo gói", async () => {
  await assert.rejects(createStoredZip([{ name: "x", file: path.join(tmpdir(), "iorder-khong-co", "x.dump") }]));
});
