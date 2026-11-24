import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { isOneClickBackupSupported, restoreLocalBackup, runLocalBackup, scheduleNightlyBackup, unscheduleNightlyBackup, unsupportedBackupMessage } from "./local-ops";

async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void> | void) {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  try { await run(); } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}

test("Sao lưu một cú bấm chỉ hỗ trợ khi database ở localhost; trong Docker (host db), máy khác hoặc thiếu biến thì không", async () => {
  for (const url of ["postgres://u:p@localhost:5432/iorder_v2", "postgres://u:p@127.0.0.1:5432/iorder_v2", "postgres://u:p@[::1]:5432/iorder_v2"]) {
    await withEnv({ DATABASE_URL: url }, () => assert.equal(isOneClickBackupSupported(), true, url));
  }
  for (const url of ["postgres://u:p@db:5432/iorder_v2", "postgres://u:p@10.0.0.5:5432/iorder_v2", undefined]) {
    await withEnv({ DATABASE_URL: url }, () => assert.equal(isOneClickBackupSupported(), false, String(url)));
  }
});

test("CMS chạy trong Docker: Sao lưu ngay, phục hồi và lịch tự động báo rõ lý do, không tạo thư mục sao lưu, không ghi thành lỗi", async () => {
  const sandbox = await mkdtemp(path.join(tmpdir(), "iorder-local-ops-"));
  const backupDir = path.join(sandbox, "iorder-backups");
  try {
    await withEnv({ DATABASE_URL: "postgres://u:p@db:5432/iorder_v2", BACKUP_LOCAL_DIR: backupDir }, async () => {
      const refused = { ok: false, message: unsupportedBackupMessage };
      assert.deepEqual(await runLocalBackup(), refused);
      assert.deepEqual(await restoreLocalBackup("20261101T100000Z"), refused);
      assert.deepEqual(await scheduleNightlyBackup(), refused);
      assert.deepEqual(await unscheduleNightlyBackup(), refused);
      await assert.rejects(access(backupDir), "thư mục sao lưu không được tạo khi môi trường không hỗ trợ");
    });
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
  assert.match(unsupportedBackupMessage, /Docker/);
  assert.match(unsupportedBackupMessage, /pnpm backup:local/);
});
