import assert from "node:assert/strict";
import test from "node:test";

import { backupSuccessSchema, summarizeBackupStatus, type BackupFailure, type BackupSuccess } from "./backup-status";

const now = new Date("2026-11-04T10:00:00Z");
const success = (finishedAt: string): BackupSuccess => ({ finishedAt, source: "vps", stamp: "20261104T023000Z", databaseBytes: 1024, verified: true, users: 3, mediaAssets: 10 });
const failure = (failedAt: string): BackupFailure => ({ failedAt, source: "vps", message: "pg_dump lỗi" });

test("Chưa chạy lần nào là never; thành công trong 36 giờ là ok, quá 36 giờ là stale", () => {
  assert.equal(summarizeBackupStatus(null, null, now).state, "never");
  assert.equal(summarizeBackupStatus(success("2026-11-03T02:30:00Z"), null, now).state, "ok");
  assert.equal(summarizeBackupStatus(success("2026-11-02T21:59:00Z"), null, now).state, "stale");
});

test("Lỗi mới hơn lần thành công là failed; lỗi cũ hơn thì bỏ qua", () => {
  assert.equal(summarizeBackupStatus(success("2026-11-04T02:30:00Z"), failure("2026-11-04T03:00:00Z"), now).state, "failed");
  assert.equal(summarizeBackupStatus(null, failure("2026-11-04T03:00:00Z"), now).state, "failed");
  const recovered = summarizeBackupStatus(success("2026-11-04T02:30:00Z"), failure("2026-11-03T02:30:00Z"), now);
  assert.equal(recovered.state, "ok");
  assert.ok(recovered.lastSuccess?.finishedAt instanceof Date);
});

test("Schema nhận đúng JSON script ghi, kể cả múi giờ +07:00 của PowerShell", () => {
  assert.ok(backupSuccessSchema.safeParse({ ...success("2026-11-04T09:30:00.123+07:00"), source: "windows", users: null, mediaAssets: null }).success);
  assert.equal(backupSuccessSchema.safeParse({ ...success("hôm qua") }).success, false);
  assert.equal(backupSuccessSchema.safeParse({ ...success("2026-11-04T02:30:00Z"), source: "laptop" }).success, false);
});
