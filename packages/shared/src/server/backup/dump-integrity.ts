import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

/** Bản sao lưu không dùng được vì thiếu/lệch checksum: người dùng cần chọn bản khác, không phải lỗi hệ thống. */
export class BackupIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupIntegrityError";
  }
}

export async function sha256File(file: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

/** Đọc SHA256SUMS do `sha256sum`, scripts/backup.sh hoặc backup.ps1 ghi: "<64 hex>  ./tên.dump" (dấu "*" là chế độ nhị phân). */
export function parseChecksums(text: string): Map<string, string> {
  const sums = new Map<string, string>();
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const match = /^([0-9a-fA-F]{64}) [ *](?:\.\/)?(.+?)\s*$/.exec(line);
    if (match) sums.set(match[2]!, match[1]!.toLowerCase());
  }
  return sums;
}

/**
 * Chắc tệp dump còn đúng như lúc sao lưu trước khi dùng nó để ghi đè dữ liệu thật: tệp bị cắt cụt, hỏng ổ đĩa
 * hay bị sửa tay đều làm checksum lệch. Thiếu SHA256SUMS cũng bị từ chối — không có gì để chứng minh bản còn nguyên.
 */
export async function verifyDumpChecksum(folder: string, fileName: string, hashFile: (file: string) => Promise<string> = sha256File): Promise<void> {
  const text = await readFile(path.join(folder, "SHA256SUMS"), "utf8").catch(() => null);
  if (text === null) throw new BackupIntegrityError("Bản sao lưu thiếu tệp SHA256SUMS nên không kiểm tra được còn nguyên vẹn hay không; không phục hồi từ bản này.");
  const expected = parseChecksums(text).get(fileName);
  if (!expected) throw new BackupIntegrityError(`SHA256SUMS của bản sao lưu không có dòng nào cho ${fileName}; không phục hồi từ bản này.`);
  if ((await hashFile(path.join(folder, fileName))) !== expected) {
    throw new BackupIntegrityError(`Bản sao lưu đã hỏng hoặc bị sửa: checksum của ${fileName} không khớp SHA256SUMS. Hãy chọn bản khác.`);
  }
}
