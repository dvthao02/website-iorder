import assert from "node:assert/strict";
import test from "node:test";
import { withTemporaryDatabase } from "./temporary-database";
import { restoreLocalBackup } from "./local-ops";

test("Chỉ dọn database do lượt thử tạo thành công, kể cả khi phục hồi lỗi", async () => {
  const created: string[] = [], removed: string[] = [];
  const operations = { create: async (name: string) => { created.push(name); }, remove: async (name: string) => { removed.push(name); } };
  await assert.rejects(withTemporaryDatabase({ ...operations, use: async () => { throw new Error("restore failed"); } }), /restore failed/);
  assert.deepEqual(removed, created);
  assert.match(created[0], /^iorder_restore_check_[0-9a-f]{32}$/);
  await withTemporaryDatabase({ ...operations, use: async () => true });
  assert.notEqual(created[0], created[1]);
  let removedOnCollision = false;
  await assert.rejects(withTemporaryDatabase({ create: async () => { throw new Error("already exists"); }, use: async () => true, remove: async () => { removedOnCollision = true; } }), /already exists/);
  assert.equal(removedOnCollision, false);
});

test("Từ chối tên bản sao lưu là đường dẫn trước mọi thao tác phục hồi", async () => {
  assert.deepEqual(await restoreLocalBackup("../../outside"), { ok: false, message: "Tên bản sao lưu không hợp lệ." });
});
