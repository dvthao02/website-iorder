import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { parseChecksums, verifyDumpChecksum } from "./dump-integrity";

const sha = (content: string) => createHash("sha256").update(content).digest("hex");

test("Đọc SHA256SUMS kiểu sha256sum, nhị phân, CRLF và BOM", () => {
  const a = sha("a"), b = sha("b"), c = sha("c");
  const sums = parseChecksums(`﻿${a.toUpperCase()}  ./iorder_v2.dump\r\n${b} *umami.dump\n\nrác không phải dòng checksum\n${c}  khong-co-dau-cham.dump\n`);
  assert.deepEqual([...sums], [["iorder_v2.dump", a], ["umami.dump", b], ["khong-co-dau-cham.dump", c]]);
});

async function withBackupFolder(sumsFor: (dump: string) => string | null, run: (folder: string) => Promise<void>) {
  const folder = await mkdtemp(path.join(tmpdir(), "iorder-dump-"));
  try {
    await writeFile(path.join(folder, "iorder_v2.dump"), "nội dung dump");
    const sums = sumsFor("nội dung dump");
    if (sums !== null) await writeFile(path.join(folder, "SHA256SUMS"), sums);
    await run(folder);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

test("Checksum khớp thì cho phục hồi", async () => {
  await withBackupFolder(content => `${sha(content)}  ./iorder_v2.dump\n`, async (folder) => {
    await verifyDumpChecksum(folder, "iorder_v2.dump");
  });
});

test("Tệp dump bị sửa hoặc cắt cụt bị từ chối", async () => {
  await withBackupFolder(content => `${sha(content)}  ./iorder_v2.dump\n`, async (folder) => {
    await writeFile(path.join(folder, "iorder_v2.dump"), "nội dung dump bị cắt c");
    await assert.rejects(verifyDumpChecksum(folder, "iorder_v2.dump"), /không khớp SHA256SUMS/);
  });
});

test("Thiếu SHA256SUMS hoặc thiếu dòng của tệp thì từ chối thay vì bỏ qua", async () => {
  await withBackupFolder(() => null, async (folder) => {
    await assert.rejects(verifyDumpChecksum(folder, "iorder_v2.dump"), /thiếu tệp SHA256SUMS/);
  });
  await withBackupFolder(content => `${sha(content)}  ./umami.dump\n`, async (folder) => {
    await assert.rejects(verifyDumpChecksum(folder, "iorder_v2.dump"), /không có dòng nào cho iorder_v2.dump/);
  });
});
