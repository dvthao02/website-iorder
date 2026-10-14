import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/core/src/db/schema";
import { listAuditLogsPage } from "../packages/core/src/server/audit/audit.repository";
import { auditListPageSchema } from "../packages/core/src/server/audit/audit.contract";

config({ quiet: true });
const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Audit nhật ký chỉ chạy PostgreSQL local.");
const scope = `cms_log_audit_${randomUUID().replaceAll("-", "")}`;
const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const db = drizzle({ client, schema });
let created = false;
async function main() {
  try {
    await client`create schema ${client(scope)}`;
    created = true;
    for (const table of ["users", "audit_logs"]) await client`create table ${client(scope)}.${client(table)} (like public.${client(table)} including all)`;
    await client`select set_config('search_path', ${scope}, false)`;
    const [current] = await client`select current_schema() as name`;
    assert.equal(current.name, scope);
    const actor = randomUUID();
    await client`insert into users (id, username, full_name, password_hash) values (${actor}, 'audit_fixture', 'Người kiểm thử', 'khong-phai-hash-dang-nhap')`;
    const ids = Array.from({ length: 12 }, () => randomUUID());
    for (let i = 0; i < ids.length; i++) await client`insert into audit_logs (id, user_id, action, entity_type, created_at, before_data, after_data) values (${ids[i]}, ${i < 6 ? actor : null}, 'audit.100%_', ${i % 2 ? "equipment" : "page"}, '2026-10-10T00:00:00Z', '{"fixture":"before"}', '{"fixture":"after"}')`;
    const query = { page: 1, pageSize: 5, query: "", entityType: "" };
    const combined: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = auditListPageSchema.parse(await listAuditLogsPage({ ...query, page }, db));
      assert.equal(result.total, 12);
      assert.equal(result.totalPages, 3);
      assert.equal(result.items.length, page === 3 ? 2 : 5);
      combined.push(...result.items.map(row => row.id));
    }
    assert.deepEqual(combined, ids.sort().reverse());
    const filtered = await listAuditLogsPage({ ...query, entityType: "equipment" }, db);
    assert.equal(filtered.total, 6);
    assert.ok(filtered.items.every(row => row.entityType === "equipment"));
    assert.equal((await listAuditLogsPage({ ...query, query: "Người kiểm thử" }, db)).total, 6);
    assert.equal((await listAuditLogsPage({ ...query, query: "Thiết bị" }, db)).total, 6);
    assert.equal((await listAuditLogsPage({ ...query, query: "THIẾT BỊ" }, db)).total, 6);
    assert.equal((await listAuditLogsPage({ ...query, query: "Trang website" }, db)).total, 6);
    await client`update audit_logs set action='equipment.update' where entity_type='equipment'`;
    const vietnameseAction = await listAuditLogsPage({ ...query, query: "Cập nhật", entityType: "equipment" }, db);
    assert.equal(vietnameseAction.total, 6);
    assert.equal(vietnameseAction.items.length, 5);
    assert.ok(vietnameseAction.items.every(row => row.action === "equipment.update"));
    assert.equal((await listAuditLogsPage({ ...query, query: "Cập nhật".normalize("NFD") }, db)).total, 6);
    // Khôi phục fixture cho các assertion wildcard phía dưới.
    await client`update audit_logs set action='audit.100%_' where entity_type='equipment'`;
    assert.equal((await listAuditLogsPage({ ...query, query: "%_" }, db)).total, 12);
    assert.equal((await listAuditLogsPage({ ...query, query: "__" }, db)).total, 0);
    const empty = await listAuditLogsPage({ ...query, page: 4 }, db);
    assert.equal(empty.items.length, 0);
    const all = await listAuditLogsPage({ ...query, pageSize: 25 }, db);
    assert.equal(all.items.filter(row => row.userName === null).length, 6);
    for (const row of all.items) { assert.equal("beforeData" in row, false); assert.equal("afterData" in row, false); assert.equal("ipHash" in row, false); }
    console.log("Đạt: nhật ký phân trang đồng hạng, filter/count, tìm người/wildcard literal, user null và whitelist đúng.");
  } catch {
    console.error("Audit nhật ký DB thất bại; kiểm tra schema local/assertion, không in SQL hoặc dữ liệu nhạy cảm.");
    process.exitCode = 1;
  } finally {
    if (created) {
      if (!/^cms_log_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Schema kiểm thử không hợp lệ.");
      await client`drop schema ${client(scope)} cascade`;
      const [remaining] = await client`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema nhật ký kiểm thử; không thay public.");
    }
    await client.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn dẹp audit nhật ký local."); process.exitCode = 1; });
