import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { acquireBackupFileLock } from "./operation-lock";

test("Khóa tạo tệp .lock trong thư mục sao lưu (kể cả khi thư mục chưa có) và nhả được", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "iorder-lock-"));
  try {
    const backupDir = path.join(root, "chua-co");
    const release = await acquireBackupFileLock(backupDir);
    assert.ok(release);
    await access(path.join(backupDir, ".lock"));
    await release();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Script đang giữ tệp (EBUSY) nghĩa là đang bận; lỗi khác phải báo thật", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "iorder-lock-"));
  try {
    const failWith = (code: string) => async () => { throw Object.assign(new Error(code), { code }); };
    assert.equal(await acquireBackupFileLock(root, failWith("EBUSY")), null);
    await assert.rejects(acquireBackupFileLock(root, failWith("EACCES")), /EACCES/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
