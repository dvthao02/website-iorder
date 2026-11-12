import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../packages/shared/src/db/schema";
import { saveRedirect, deleteRedirect, redirectMovedContent } from "../packages/shared/src/server/redirects/redirects.repository";
import { hasDatabaseErrorCode } from "../packages/shared/src/server/shared/database-error";

config({ quiet: true });
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Chỉ kiểm thử DB local.");
  const scope = `cms_audit_${randomUUID().replaceAll("-", "")}`;
  const control = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  const clients = [0, 1].map(() => postgres(url, { max: 1, prepare: false, onnotice: () => undefined }));
  let created = false;
  try {
    await control`create schema ${control(scope)}`;
    created = true;
    for (const table of ["redirects", "audit_logs"]) await control`create table ${control(scope)}.${control(table)} (like public.${control(table)} including all)`;
    for (const client of clients) {
      await client`select set_config('search_path', ${scope}, false)`;
      await client`select set_config('statement_timeout', '8000', false)`;
      assert.equal((await client`select current_schema() as name`)[0].name, scope);
    }
    const db = clients.map(client => drizzle({ client, schema }));
    const actor = randomUUID();
    const a = { sourcePath: "/audit-a", destinationPath: "/audit-b", statusCode: 301 as const, isEnabled: true };
    const b = { ...a, sourcePath: "/audit-b", destinationPath: "/audit-a" };
    const outcomes = await Promise.allSettled([saveRedirect(null, a, actor, db[0]), saveRedirect(null, b, actor, db[1])]);
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    const failure = outcomes.find(result => result.status === "rejected");
    assert.ok(failure?.status === "rejected" && failure.reason instanceof z.ZodError);
    const [winner] = await clients[0]`select id, source_path, destination_path from redirects`;
    const winningValues = winner.source_path === a.sourcePath ? a : b;
    const losingValues = winner.source_path === a.sourcePath ? b : a;
    await assert.rejects(saveRedirect(null, winningValues, actor, db[0]), error => hasDatabaseErrorCode(error, "23505"));
    const disabledId = await saveRedirect(null, { ...losingValues, isEnabled: false }, actor, db[0]);
    assert.ok(disabledId);
    await assert.rejects(saveRedirect(disabledId, losingValues, actor, db[1]), z.ZodError);
    assert.equal((await clients[0]`select is_enabled from redirects where id=${disabledId}`)[0].is_enabled, false);
    assert.equal(await deleteRedirect(winner.id, actor, db[0]), winner.id);
    assert.equal(await saveRedirect(winner.id, winningValues, actor, db[1]), undefined);
    assert.equal(await deleteRedirect(winner.id, actor, db[1]), undefined);
    assert.equal(await saveRedirect(disabledId, losingValues, actor, db[1]), disabledId);
    assert.ok(await saveRedirect(null, { ...winningValues, destinationPath: "/audit-end" }, actor, db[0]));
    assert.equal((await clients[0]`select count(*)::int as total from audit_logs`)[0].total, 5);
    console.log("Đạt: hai redirect đối nghịch chỉ một thành công; bật lại gây vòng bị từ chối; trùng nguồn nhận 23505; xóa/sửa ID đã xóa không ghi; nguồn đã xóa được dùng lại; audit đúng năm log.");

    // Đổi slug nội dung đã xuất bản: URL cũ → URL mới, chuyển hướng cũ không thành chuỗi, URL mới không bị chiếm.
    assert.ok(await saveRedirect(null, { sourcePath: "/audit-move-chain", destinationPath: "/audit-move-a", statusCode: 301, isEnabled: true }, actor, db[0]));
    assert.ok(await saveRedirect(null, { sourcePath: "/audit-move-b", destinationPath: "/audit-end", statusCode: 301, isEnabled: true }, actor, db[0]));
    const activeMoves = async () => Object.fromEntries((await clients[0]`select source_path, destination_path from redirects where deleted_at is null and source_path like '/audit-move-%'`).map(row => [row.source_path, row.destination_path]));
    await db[0].transaction(tx => redirectMovedContent(tx, { from: "/audit-move-a", to: "/audit-move-b" }, actor));
    assert.deepEqual(await activeMoves(), { "/audit-move-chain": "/audit-move-b", "/audit-move-a": "/audit-move-b" });
    // Đổi ngược lại tên cũ: không tạo vòng lặp, dòng cũ được tái dùng.
    await db[0].transaction(tx => redirectMovedContent(tx, { from: "/audit-move-b", to: "/audit-move-a" }, actor));
    assert.deepEqual(await activeMoves(), { "/audit-move-chain": "/audit-move-a", "/audit-move-b": "/audit-move-a" });
    // Lỗi sau khi ghi trong cùng transaction (ví dụ lưu nội dung thất bại) thì không còn chuyển hướng nào được thêm.
    await assert.rejects(db[0].transaction(async tx => { await redirectMovedContent(tx, { from: "/audit-move-a", to: "/audit-move-c" }, actor); throw new Error("rollback"); }), /rollback/);
    assert.deepEqual(await activeMoves(), { "/audit-move-chain": "/audit-move-a", "/audit-move-b": "/audit-move-a" });
    console.log("Đạt: đổi slug tạo 301 từ URL cũ, gom chuỗi chuyển hướng, gỡ chuyển hướng chiếm URL mới, đổi ngược không tạo vòng, rollback cùng lần lưu.");
  } finally {
    await Promise.all(clients.map(client => client.end({ timeout: 10 })));
    try {
      if (created) {
        assert.match(scope, /^cms_audit_[a-f0-9]{32}$/);
        await control`drop schema ${control(scope)} cascade`;
        assert.equal((await control`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`)[0].total, 0);
        console.log("Đã dọn schema thử redirect; không sửa dữ liệu CMS public.");
      }
    } finally { await control.end({ timeout: 10 }); }
  }
}
main().catch(() => { console.error("Kiểm thử DB redirect không đạt; không in kết nối hoặc dữ liệu nhạy cảm."); process.exitCode = 1; });
