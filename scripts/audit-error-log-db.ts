import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/shared/src/db/schema";
import { buildErrorLogRecord } from "../packages/shared/src/server/error-log/error-log.record";
import { clearErrorLogRows, listErrorLogsPage, recordErrorLog } from "../packages/shared/src/server/error-log/error-log.repository";
import { buildLogEntry } from "../packages/shared/src/server/shared/logger";

// Kiểm Nhật ký lỗi trên PostgreSQL local: bảng error_logs dựng từ chính tệp migration trong schema tạm (không đụng dữ liệu public).
config({ quiet: true });
const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Audit Nhật ký lỗi chỉ chạy PostgreSQL local.");
const scope = `cms_error_log_audit_${randomUUID().replaceAll("-", "")}`;
const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const db = drizzle({ client, schema });
let created = false;

const request = (path: string, id: string) => new Request(`http://backend${path}`, { method: "POST", headers: { "x-request-id": id } });
const record = (message: string, fields: Parameters<typeof buildLogEntry>[2] = {}) => buildErrorLogRecord(buildLogEntry("error", message, fields, "api"));
const query = (overrides: Partial<Parameters<typeof listErrorLogsPage>[0]> = {}) => ({ page: 1, pageSize: 25, query: "", ...overrides });

async function main() {
  try {
    await client`create schema ${client(scope)}`;
    created = true;
    await client`create table ${client(scope)}.audit_logs (like public.audit_logs including all)`;
    await client`select set_config('search_path', ${scope}, false)`;
    const [current] = await client`select current_schema() as name`;
    assert.equal(current.name, scope);
    for (const statement of readFileSync(new URL("../drizzle/0010_error_logs.sql", import.meta.url), "utf8").split("--> statement-breakpoint")) await client.unsafe(statement);

    // 1. Cùng một lỗi lặp lại: một dòng, tăng số lần, giữ lần đầu, cập nhật mã request và chi tiết lần gần nhất.
    const cause = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint_name: "authors_slug_unique" });
    const authorError = (id: string, requestId: string) => record("Lưu tác giả trong CMS thất bại.", { request: request(`/api/v1/admin/authors/${id}`, requestId), error: new Error("Failed query", { cause }) });
    await recordErrorLog(authorError(randomUUID(), "req-first-0001"), db);
    const [first] = await client`select first_seen_at, last_seen_at from error_logs`;
    await new Promise((resolve) => setTimeout(resolve, 15));
    await recordErrorLog(authorError(randomUUID(), "req-second-0002"), db);
    await recordErrorLog(authorError(randomUUID(), "req-third-0003"), db);
    const [row] = await client`select occurrences, request_id, first_seen_at, last_seen_at, details from error_logs`;
    assert.equal((await client`select count(*)::int as total from error_logs`)[0].total, 1, "ba lần lỗi giống nhau chỉ có một dòng");
    assert.equal(row.occurrences, 3);
    assert.equal(row.request_id, "req-third-0003");
    assert.deepEqual(row.first_seen_at, first.first_seen_at, "lần đầu không bị ghi đè");
    assert.ok(row.last_seen_at > first.last_seen_at, "lần gần nhất được làm mới");
    assert.equal(row.details.error.cause.code, "23505");
    console.log("Đạt: lỗi lặp lại gom thành một dòng, tăng số lần, giữ lần đầu, làm mới lần gần nhất và chi tiết.");

    // 2. Nhiều lỗi khác nhau: sắp theo lần gần nhất, phân trang, sắp theo số lần.
    for (let index = 0; index < 11; index++) {
      await recordErrorLog(record(`Lỗi riêng số ${index}.`, { request: request(`/api/v1/admin/pages/${index + 100}`, `req-bulk-${String(index).padStart(4, "0")}`), error: new Error(`Hỏng kiểu ${index}`) }), db);
    }
    const page1 = await listErrorLogsPage(query({ pageSize: 5 }), db);
    assert.equal(page1.total, 12);
    assert.equal(page1.totalPages, 3);
    assert.equal(page1.items.length, 5);
    assert.equal(page1.items[0].message, "Lỗi riêng số 10.", "lỗi mới nhất đứng đầu");
    const page3 = await listErrorLogsPage(query({ pageSize: 5, page: 3 }), db);
    assert.equal(page3.items.length, 2);
    assert.equal(new Set([...page1.items, ...(await listErrorLogsPage(query({ pageSize: 5, page: 2 }), db)).items, ...page3.items].map((item) => item.id)).size, 12, "các trang không trùng, không sót");
    const byOccurrences = await listErrorLogsPage(query({ sort: "occurrences", dir: "desc" }), db);
    assert.equal(byOccurrences.items[0].occurrences, 3);
    assert.ok(byOccurrences.items[0].firstSeenAt instanceof Date && byOccurrences.items[0].lastSeenAt instanceof Date);
    assert.equal(byOccurrences.items[0].details.error?.cause?.constraint_name, "authors_slug_unique");
    console.log("Đạt: sắp theo lần gần nhất, phân trang không trùng/sót, sắp theo số lần, chi tiết đọc lại đúng kiểu.");

    // 3. Tìm kiếm: theo đường dẫn, mã request, câu báo lỗi; ký tự % và _ được hiểu theo nghĩa đen.
    await recordErrorLog(record("Giảm giá 100%_ thất bại.", { request: request("/api/v1/admin/promotion-popup", "req-percent-0001") }), db);
    assert.equal((await listErrorLogsPage(query({ query: "/authors/" }), db)).total, 1);
    assert.equal((await listErrorLogsPage(query({ query: "req-bulk-0003" }), db)).total, 1);
    assert.equal((await listErrorLogsPage(query({ query: "Hỏng kiểu 7" }), db)).total, 1);
    assert.equal((await listErrorLogsPage(query({ query: "100%_" }), db)).total, 1);
    assert.equal((await listErrorLogsPage(query({ query: "%" }), db)).total, 1, "% chỉ khớp dòng có dấu %, không khớp mọi dòng");
    assert.equal((await listErrorLogsPage(query({ query: "không có lỗi nào như vậy" }), db)).total, 0);
    console.log("Đạt: tìm theo đường dẫn, mã request, câu báo lỗi; % và _ không thành ký tự đại diện.");

    // 4. Xóa: một dòng, id lạ, toàn bộ; mỗi lần xóa thật để lại một dòng nhật ký hoạt động.
    const actorId = randomUUID();
    const target = (await listErrorLogsPage(query({ query: "Hỏng kiểu 7" }), db)).items[0];
    assert.deepEqual(await clearErrorLogRows({ mode: "one", id: target.id }, actorId, db), { affected: 1 });
    assert.deepEqual(await clearErrorLogRows({ mode: "one", id: randomUUID() }, actorId, db), { affected: 0 });
    assert.equal((await client`select count(*)::int as total from audit_logs`)[0].total, 1, "xóa không có gì thì không ghi nhật ký hoạt động");
    const [auditOne] = await client`select user_id, action, entity_type, entity_id, after_data from audit_logs`;
    assert.deepEqual({ user: auditOne.user_id, action: auditOne.action, entity: auditOne.entity_type, entityId: auditOne.entity_id, after: auditOne.after_data }, { user: actorId, action: "error_log.delete", entity: "error_log", entityId: target.id, after: { scope: "one", deleted: 1 } });
    assert.deepEqual(await clearErrorLogRows({ mode: "all" }, actorId, db), { affected: 12 });
    assert.equal((await listErrorLogsPage(query(), db)).total, 0);
    assert.deepEqual(await clearErrorLogRows({ mode: "all" }, actorId, db), { affected: 0 });
    const audits = await client`select entity_id, after_data from audit_logs order by created_at, id`;
    assert.equal(audits.length, 2);
    assert.deepEqual(audits.map((audit) => audit.after_data), [{ scope: "one", deleted: 1 }, { scope: "all", deleted: 12 }]);
    console.log("Đạt: xóa một dòng/toàn bộ đúng số lượng, ghi nhật ký hoạt động đúng người, không ghi khi không xóa gì.");
  } catch (error) {
    console.error("Audit Nhật ký lỗi DB thất bại. Kiểm tra DB local/schema hoặc assertion.");
    // Mặc định im lặng; đặt AUDIT_DEBUG=1 khi cần xem lỗi gốc (dữ liệu ở đây chỉ là fixture trong schema tạm).
    if (process.env.AUDIT_DEBUG === "1") console.error(error);
    process.exitCode = 1;
  } finally {
    if (created) {
      if (!/^cms_error_log_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Schema kiểm thử không hợp lệ.");
      await client`drop schema ${client(scope)} cascade`;
      const [remaining] = await client`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema kiểm thử Nhật ký lỗi; không thay dữ liệu public.");
    }
    await client.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn dẹp audit Nhật ký lỗi local."); process.exitCode = 1; });
