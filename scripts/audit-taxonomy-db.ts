import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { z } from "zod";
import * as schema from "../packages/core/src/db/schema";
import { saveCategory } from "../packages/core/src/server/taxonomy/taxonomy.repository";
import { hasDatabaseErrorCode } from "../packages/core/src/server/shared/database-error";

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
    for (const table of ["categories", "audit_logs"]) {
      await control`create table ${control(scope)}.${control(table)} (like public.${control(table)} including all)`;
    }
    for (const client of clients) {
      await client`select set_config('search_path', ${scope}, false)`;
      await client`select set_config('statement_timeout', '8000', false)`;
      const [current] = await client`select current_schema() as name`;
      assert.equal(current.name, scope);
    }
    const db = clients.map(client => drizzle({ client, schema }));
    const actor = randomUUID();
    const base = { name: "Chuyên mục thử", description: null, sortOrder: 0, parentId: null };
    const a = await saveCategory(null, { ...base, slug: "audit-a" }, actor, db[0]);
    const b = await saveCategory(null, { ...base, slug: "audit-b" }, actor, db[0]);
    assert.ok(a && b);
    const outcomes = await Promise.allSettled([
      saveCategory(a, { ...base, slug: "audit-a", parentId: b }, actor, db[0]),
      saveCategory(b, { ...base, slug: "audit-b", parentId: a }, actor, db[1]),
    ]);
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    const rejected = outcomes.find(result => result.status === "rejected");
    assert.ok(rejected?.status === "rejected" && rejected.reason instanceof z.ZodError);
    const rows = await clients[0]`select id, parent_id from categories`;
    assert.equal(rows.filter(row => row.parent_id === null).length, 1);
    assert.equal(rows.filter(row => row.parent_id !== null).length, 1);
    await assert.rejects(saveCategory(null, { ...base, slug: "missing-parent", parentId: randomUUID() }, actor, db[0]), z.ZodError);
    assert.equal(await saveCategory(randomUUID(), { ...base, slug: "missing-target" }, actor, db[0]), undefined);
    await assert.rejects(
      saveCategory(null, { ...base, slug: "audit-a" }, actor, db[0]),
      error => hasDatabaseErrorCode(error, "23505"),
    );
    await assert.rejects(
      saveCategory(b, { ...base, slug: "audit-a" }, actor, db[0]),
      error => hasDatabaseErrorCode(error, "23505"),
    );
    const [unchanged] = await clients[0]`select slug from categories where id=${b}`;
    assert.equal(unchanged.slug, "audit-b");
    const [logs] = await clients[0]`select count(*)::int as total from audit_logs`;
    assert.equal(logs.total, 3);
    console.log("Đạt: hai lần đổi cha ngược nhau chỉ một thành công; cây không có vòng lặp; cha mất bị từ chối, target mất không ghi, giao dịch lỗi không thừa audit.");
    console.log("Đạt: trùng slug khi tạo/sửa được nhận diện mã 23505 qua lỗi DB thật; cập nhật bị từ chối giữ slug cũ và không thêm audit.");
  } finally {
    await Promise.all(clients.map(client => client.end({ timeout: 10 })));
    try {
      if (created) {
        assert.match(scope, /^cms_audit_[a-f0-9]{32}$/);
        await control`drop schema ${control(scope)} cascade`;
        const [remaining] = await control`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
        assert.equal(remaining.total, 0);
        console.log("Đã dọn schema thử chuyên mục; không sửa dữ liệu CMS public.");
      }
    } finally { await control.end({ timeout: 10 }); }
  }
}

main().catch(() => {
  console.error("Kiểm thử DB chuyên mục không đạt; không in kết nối hoặc dữ liệu nhạy cảm.");
  process.exitCode = 1;
});
