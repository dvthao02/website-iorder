import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { BackupRefusedError, deleteBackupFolder, listBackupStamps, pickMainDump, pruneOldBackups, scanBackupLibrary, stampToDate } from "./backup-library";

async function withBackupDir(run: (backupDir: string, add: (stamp: string, files?: Record<string, string>) => Promise<void>) => Promise<void>) {
  const backupDir = await mkdtemp(path.join(tmpdir(), "iorder-library-"));
  const add = async (stamp: string, files: Record<string, string> = { "iorder_v2.dump": "dump", SHA256SUMS: "sums" }) => {
    const folder = path.join(backupDir, "db", stamp);
    await mkdir(folder, { recursive: true });
    for (const [name, content] of Object.entries(files)) await writeFile(path.join(folder, name), content);
  };
  try {
    await run(backupDir, add);
  } finally {
    await rm(backupDir, { recursive: true, force: true });
  }
}

const exists = (file: string) => access(file).then(() => true, () => false);

test("Chọn tệp dump chính: đúng tên database, hoặc tệp duy nhất không phải Umami (bản chép từ máy khác)", () => {
  assert.equal(pickMainDump(["iorder_v2.dump", "umami.dump"], "iorder_v2"), "iorder_v2.dump");
  assert.equal(pickMainDump(["iorder_prod.dump", "umami.dump"], "iorder_v2"), "iorder_prod.dump");
  assert.equal(pickMainDump(["a.dump", "b.dump"], "iorder_v2"), null, "mơ hồ thì không đoán");
  assert.equal(pickMainDump(["umami.dump"], "iorder_v2"), null);
  assert.equal(pickMainDump([], "iorder_v2"), null);
});

test("Mã thời gian đổi ra đúng giờ UTC", () => {
  assert.equal(stampToDate("20261122T103045Z").toISOString(), "2026-11-22T10:30:45.000Z");
});

test("Quét thư mục: bản do hệ thống tạo, bản chép từ máy khác, bản thiếu tệp; mục lạ được báo, tệp khóa và bản đang dở bị bỏ qua", async () => {
  await withBackupDir(async (backupDir, add) => {
    await add("20261101T100000Z");
    await add("20261102T100000Z", { "iorder_prod.dump": "dump-khac", "umami.dump": "u", SHA256SUMS: "sums" });
    await add("20261103T100000Z", { "a.dump": "1", "b.dump": "2", SHA256SUMS: "sums" });
    await add("20261104T100000Z", { "iorder_v2.dump": "dump" });
    await add("20261105T100000Z.partial", { "iorder_v2.dump": "dang-do" });
    await add("ban-chep-tay", { "iorder_v2.dump": "dump" });
    await writeFile(path.join(backupDir, "db", ".lock"), "");
    await writeFile(path.join(backupDir, "db", "ghi-chu.txt"), "x");
    await writeFile(path.join(backupDir, "db", "20261106T100000Z"), "tệp mang tên bản sao lưu");

    const library = await scanBackupLibrary(backupDir, "iorder_v2");
    assert.deepEqual(library.backups.map((backup) => backup.stamp), ["20261104T100000Z", "20261103T100000Z", "20261102T100000Z", "20261101T100000Z"], "mới nhất trước");
    const byStamp = Object.fromEntries(library.backups.map((backup) => [backup.stamp, backup]));
    assert.deepEqual([byStamp["20261101T100000Z"]!.problem, byStamp["20261101T100000Z"]!.mainDump, byStamp["20261101T100000Z"]!.bytes], [null, "iorder_v2.dump", 4]);
    assert.deepEqual([byStamp["20261102T100000Z"]!.problem, byStamp["20261102T100000Z"]!.mainDump, byStamp["20261102T100000Z"]!.dumps], [null, "iorder_prod.dump", ["iorder_prod.dump", "umami.dump"]]);
    assert.match(byStamp["20261103T100000Z"]!.problem ?? "", /không xác định được tệp \.dump/i);
    assert.match(byStamp["20261104T100000Z"]!.problem ?? "", /SHA256SUMS/);
    assert.deepEqual(library.ignored, ["20261106T100000Z", "ban-chep-tay", "ghi-chu.txt"]);
    assert.equal(library.dbDir, path.join(backupDir, "db"));
  });
});

test("Thư mục sao lưu chưa tồn tại thì danh sách rỗng, không lỗi", async () => {
  const library = await scanBackupLibrary(path.join(tmpdir(), "iorder-khong-ton-tai-xyz"), "iorder_v2");
  assert.deepEqual([library.backups, library.ignored], [[], []]);
});

test("Dọn bản cũ chỉ tính thư mục đúng dạng mã thời gian, không đụng mục lạ, bản đang dở và bản được bảo vệ", async () => {
  await withBackupDir(async (backupDir, add) => {
    for (const stamp of ["20261101T100000Z", "20261102T100000Z", "20261103T100000Z", "20261104T100000Z", "20261105T100000Z"]) await add(stamp);
    await add("zzz-ban-chep-tay");
    await add("20250101T000000Z.partial");
    assert.equal(await pruneOldBackups(backupDir, 2, ["20261101T100000Z"]), 2);
    assert.deepEqual(await listBackupStamps(backupDir), ["20261101T100000Z", "20261104T100000Z", "20261105T100000Z"], "xóa 02, 03; giữ 04, 05 mới nhất và 01 được bảo vệ");
    assert.ok(await exists(path.join(backupDir, "db", "zzz-ban-chep-tay")));
    assert.ok(await exists(path.join(backupDir, "db", "20250101T000000Z.partial")));
    assert.equal(await pruneOldBackups(backupDir, 60), 0);
  });
});

test("Xóa tay: không xóa bản dùng được cuối cùng, xóa được bản hỏng, từ chối tên lạ", async () => {
  await withBackupDir(async (backupDir, add) => {
    await add("20261101T100000Z");
    await add("20261102T100000Z", { "iorder_v2.dump": "thieu-checksum" });
    const stampDir = (stamp: string) => path.join(backupDir, "db", stamp);

    await assert.rejects(deleteBackupFolder(backupDir, "20261101T100000Z", "iorder_v2"), (error: unknown) => error instanceof BackupRefusedError && /dùng được cuối cùng/.test(error.message));
    assert.ok(await exists(stampDir("20261101T100000Z")));

    await deleteBackupFolder(backupDir, "20261102T100000Z", "iorder_v2"); // bản hỏng: xóa thoải mái
    assert.equal(await exists(stampDir("20261102T100000Z")), false);

    await add("20261103T100000Z");
    await deleteBackupFolder(backupDir, "20261101T100000Z", "iorder_v2"); // còn bản dùng được khác
    assert.deepEqual(await listBackupStamps(backupDir), ["20261103T100000Z"]);

    for (const stamp of ["../db", "20261103T100000Z/..", "", "ban-chep-tay"]) {
      await assert.rejects(deleteBackupFolder(backupDir, stamp, "iorder_v2"), BackupRefusedError, stamp);
    }
    await assert.rejects(deleteBackupFolder(backupDir, "20990101T000000Z", "iorder_v2"), /Không tìm thấy/);
    assert.deepEqual(await listBackupStamps(backupDir), ["20261103T100000Z"]);
  });
});
