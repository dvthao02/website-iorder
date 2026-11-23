import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { crc32 } from "node:zlib";

// Gói .zip không nén (store) phát trực tiếp từ đĩa: bản dump của pg_dump -Fc đã được nén sẵn nên nén thêm
// không đáng kể, và không phải nạp cả tệp vào bộ nhớ như zipFiles() của xlsx. Hai lượt đọc mỗi tệp: lượt đầu
// tính CRC-32 để ghi đúng vào local header (không dùng data descriptor, mọi phần mềm giải nén đều đọc được).
export type StoredZipEntry = { name: string; file: string };

export class ZipTooLargeError extends Error {
  constructor() {
    super("Bản sao lưu lớn hơn 4 GB nên không đóng gói .zip được. Hãy chép trực tiếp thư mục sao lưu trên máy chủ.");
    this.name = "ZipTooLargeError";
  }
}

const limit32 = 0xffffffff;

async function checksumOf(file: string) {
  let value = 0;
  for await (const chunk of createReadStream(file)) value = crc32(chunk as Buffer, value);
  return value;
}

function dosDateTime(date: Date) {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export async function createStoredZip(entries: StoredZipEntry[], modifiedAt = new Date()) {
  const stamp = dosDateTime(modifiedAt);
  const prepared: { file: string; header: Buffer; size: number }[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const size = (await stat(entry.file)).size;
    if (size > limit32) throw new ZipTooLargeError();
    const checksum = await checksumOf(entry.file);
    const name = Buffer.from(entry.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10); local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14); local.writeUInt32LE(size, 18); local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12); central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(size, 20); central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    prepared.push({ file: entry.file, header: Buffer.concat([local, name]), size });
    centrals.push(central, name);
    offset += local.length + name.length + size;
    if (offset > limit32) throw new ZipTooLargeError();
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);

  async function* body() {
    for (const item of prepared) {
      yield item.header;
      let sent = 0;
      for await (const chunk of createReadStream(item.file)) {
        sent += (chunk as Buffer).length;
        yield chunk as Buffer;
      }
      // Tệp đổi kích thước giữa hai lượt đọc thì gói đã ghi sai header: ngắt luồng để trình duyệt báo tải lỗi thay vì nhận tệp hỏng.
      if (sent !== item.size) throw new Error("Tệp sao lưu thay đổi trong lúc đóng gói.");
    }
    yield directory;
    yield end;
  }
  return { size: offset + directory.length + end.length, stream: () => Readable.from(body()) };
}
