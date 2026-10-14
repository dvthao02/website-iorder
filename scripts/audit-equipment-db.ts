import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/core/src/db/schema";
import { saveEquipment, saveEquipmentGroup, deleteArchivedEquipment, deleteEquipmentGroup, listEquipmentPage, changeEquipmentState } from "../packages/core/src/server/equipment/equipment.repository";
import { ContentVersionConflictError } from "../packages/core/src/server/shared/content-version";
import { EquipmentVersionConflictError } from "../packages/core/src/server/equipment/equipment-version";
import type { EquipmentInput } from "../packages/core/src/server/equipment/equipment.contract";

config({ quiet: true });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Audit DB chỉ được chạy với DATABASE_URL PostgreSQL local.");
}
const auditSchema = `cms_audit_${randomUUID().replaceAll("-", "")}`;
const control = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => undefined });
const clients = [0, 1].map(() => postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => undefined }));
const databases = clients.map((client) => drizzle({ client, schema }));
let created = false;

function databaseWithWriteAfterRows(write: () => Promise<void>, readCommittedControl = false) {
  let fired = false;
  function intercept<T extends object>(query: T): T {
    return new Proxy(query, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (key === "then") return (resolve: (rows: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve(target).then(async rows => {
            if (!fired) { fired = true; await write(); }
            return rows;
          }).then(resolve, reject);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const next = Reflect.apply(value, target, args);
          return next && typeof next === "object" ? intercept(next) : next;
        };
      },
    });
  }
  const database = databases[0];
  type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
  return new Proxy(database, {
    get(target, key) {
      if (key !== "transaction") return Reflect.get(target, key);
      return (callback: (tx: Transaction) => Promise<unknown>, options: Parameters<typeof database.transaction>[1]) =>
        target.transaction(tx => callback(new Proxy(tx, {
          get(transaction, property) {
            if (property === "select") return (...args: unknown[]) => intercept(Reflect.apply(transaction.select, transaction, args));
            return Reflect.get(transaction, property);
          },
        })), readCommittedControl ? { ...options, isolationLevel: "read committed" } : options);
    },
  });
}

async function run() {
  await control`create schema ${control(auditSchema)}`;
  created = true;
  // Chỉ sao chép cấu trúc/index/default, tuyệt đối không copy dữ liệu public.
  for (const table of ["equipment_groups", "sales_equipment", "sales_equipment_revisions", "audit_logs", "media_assets"]) {
    await control`create table ${control(auditSchema)}.${control(table)} (like ${control("public")}.${control(table)} including all)`;
  }
  for (const client of clients) {
    await client`select set_config('search_path', ${auditSchema}, false)`;
    await client`select set_config('statement_timeout', '8000', false)`;
    const [scope] = await client`select current_schema() as name`;
    assert.equal(scope.name, auditSchema);
  }

  const actorId = randomUUID(); // FK không được LIKE sao chép; không tạo user thật.
  const groupId = await saveEquipmentGroup(null, { name: "Nhóm audit", slug: "nhom-audit", description: null, coverMediaId: null, sortOrder: 0, isEnabled: true }, actorId, databases[0]);
  assert.ok(groupId);
  const values: EquipmentInput = { groupId, name: "Thiết bị audit", slug: "thiet-bi-audit", modelCode: null, coverMediaId: null, priceVnd: 0, warrantyMonths: 12, summary: null, specificationGroups: [], status: "draft", scheduledAt: null, sortOrder: 0, isFeatured: false, seoTitle: null, seoDescription: null, canonicalUrl: null };
  const itemId = await saveEquipment(null, values, actorId, "Audit tạo mới", undefined, databases[0]);
  assert.ok(itemId);

  assert.equal(await saveEquipmentGroup(groupId, { name: "Nhóm đã sửa", slug: "nhom-audit", description: "Mô tả nhóm đã sửa", coverMediaId: null, sortOrder: 7, isEnabled: false }, actorId, databases[0]), groupId);
  const [editedGroup] = await clients[0]`select name, description, sort_order, is_enabled from equipment_groups where id=${groupId}`;
  assert.deepEqual(editedGroup, { name: "Nhóm đã sửa", description: "Mô tả nhóm đã sửa", sort_order: 7, is_enabled: false });
  const missingId = randomUUID();
  assert.equal(await saveEquipment(missingId, values, actorId, "ID không tồn tại", 1, databases[0]), undefined);
  assert.equal(await saveEquipmentGroup(missingId, { name: "Không tồn tại", slug: "khong-ton-tai", description: null, coverMediaId: null, sortOrder: 0, isEnabled: true }, actorId, databases[0]), undefined);
  const [beforeDuplicate] = await clients[0]`select (select count(*)::int from audit_logs) as audits, (select count(*)::int from sales_equipment_revisions) as revisions`;
  await assert.rejects(saveEquipment(null, values, actorId, "Slug trùng", undefined, databases[1]));
  const [afterDuplicate] = await clients[0]`select (select count(*)::int from audit_logs) as audits, (select count(*)::int from sales_equipment_revisions) as revisions`;
  assert.deepEqual(afterDuplicate, beforeDuplicate);
  const [missingWrites] = await clients[0]`select count(*)::int as total from audit_logs where entity_id=${missingId}`;
  assert.equal(missingWrites.total, 0);
  const [duplicateItems] = await clients[0]`select count(*)::int as total from sales_equipment where slug=${values.slug}`;
  assert.equal(duplicateItems.total, 1);
  console.log("Đạt: sửa nhóm lưu đúng field; ID không tồn tại không ghi audit; slug trùng rollback không thừa bản ghi/revision/audit.");

  const outcomes = await Promise.allSettled([
    saveEquipment(itemId, { ...values, name: "Phiên A" }, actorId, "Audit A", 1, databases[0]),
    saveEquipment(itemId, { ...values, name: "Phiên B" }, actorId, "Audit B", 1, databases[1]),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = outcomes.find((result) => result.status === "rejected");
  assert.ok(rejected?.status === "rejected" && rejected.reason instanceof EquipmentVersionConflictError);
  const [current] = await clients[0]`select draft_version, name from sales_equipment where id = ${itemId}`;
  assert.equal(current.draft_version, 2);
  assert.ok(["Phiên A", "Phiên B"].includes(current.name));
  const [history] = await clients[0]`select count(*)::int as total from sales_equipment_revisions where sales_equipment_id = ${itemId}`;
  const [audit] = await clients[0]`select count(*)::int as total from audit_logs where entity_id = ${itemId}`;
  assert.equal(history.total, 2);
  assert.equal(audit.total, 2);
  console.log("Đạt: hai giao dịch cùng version chỉ một ghi thành công; không thừa revision/audit.");

  await assert.rejects(saveEquipment(itemId, values, actorId, "Audit thiếu version", undefined, databases[0]), EquipmentVersionConflictError);
  await saveEquipment(itemId, { ...values, status: "archived" }, actorId, "Audit lưu trữ", 2, databases[0]);
  await assert.rejects(deleteArchivedEquipment(itemId, actorId, 2, databases[1]), EquipmentVersionConflictError);
  const [notDeleted] = await clients[0]`select deleted_at, draft_version from sales_equipment where id = ${itemId}`;
  assert.equal(notDeleted.deleted_at, null);
  assert.equal(notDeleted.draft_version, 3);
  assert.deepEqual(await deleteEquipmentGroup(groupId, actorId, databases[1]), { blockedBy: "items" });
  assert.ok(await deleteArchivedEquipment(itemId, actorId, 3, databases[0]));
  assert.ok(await deleteEquipmentGroup(groupId, actorId, databases[0]));
  await assert.rejects(saveEquipment(null, { ...values, slug: "khong-tao-mo-coi" }, actorId, undefined, undefined, databases[1]));
  const [orphans] = await clients[0]`select count(*)::int as total from sales_equipment where slug = 'khong-tao-mo-coi'`;
  assert.equal(orphans.total, 0);
  console.log("Đạt: version thiếu/cũ bị chặn; xóa đúng version; nhóm còn con bị chặn; không ghi vào nhóm đã xóa.");

  const secondGroupId = await saveEquipmentGroup(null, { name: "Nhóm cạnh tranh", slug: "nhom-canh-tranh", description: null, coverMediaId: null, sortOrder: 0, isEnabled: true }, actorId, databases[0]);
  assert.ok(secondGroupId);
  const [writerSession] = await clients[1]`select pg_backend_pid() as pid`;
  let pending: ReturnType<typeof saveEquipment> | undefined;
  await clients[0].begin(async (transaction) => {
    await transaction`select id from equipment_groups where id = ${secondGroupId} for update`;
    await transaction`update equipment_groups set deleted_at = now(), is_enabled = false where id = ${secondGroupId}`;
    pending = saveEquipment(null, { ...values, groupId: secondGroupId, slug: "canh-tranh-nhom" }, actorId, undefined, undefined, databases[1]);
    // Gắn rejection handler ngay; assertion thực hiện sau khi transaction nhả khóa.
    void pending.catch(() => undefined);
    const deadline = Date.now() + 4000;
    let blocked = false;
    while (Date.now() < deadline) {
      const [lock] = await control`select cardinality(pg_blocking_pids(${writerSession.pid})) > 0 as blocked`;
      if (lock.blocked) { blocked = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(blocked, "Giao dịch ghi phải chờ khóa xóa nhóm.");
  });
  assert.ok(pending);
  await assert.rejects(pending);
  const [racedOrphans] = await clients[1]`select count(*)::int as total from sales_equipment where slug = 'canh-tranh-nhom'`;
  assert.equal(racedOrphans.total, 0);
  console.log("Đạt: writer thực sự chờ khóa nhóm; sau soft-delete không tạo thiết bị mồ côi.");

  const listGroup = await saveEquipmentGroup(null, { name: "Nhóm phân trang", slug: "nhom-phan-trang", description: null, coverMediaId: null, sortOrder: 0, isEnabled: true }, actorId, databases[0]);
  assert.ok(listGroup);
  const fixtureIds: string[] = [];
  for (let index = 0; index < 12; index += 1) {
    const id = await saveEquipment(null, { ...values, groupId: listGroup, name: "Thiết bị đồng hạng 100%_", slug: `dong-hang-${index}` }, actorId, undefined, undefined, databases[0]);
    assert.ok(id);
    fixtureIds.push(id);
  }
  await clients[0]`update sales_equipment set updated_at='2026-01-01T00:00:00Z' where group_id=${listGroup}`;
  const query = { page: 1, pageSize: 5, query: "", groupId: listGroup, status: "draft" as const };
  const combined: string[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const result = await listEquipmentPage({ ...query, page }, databases[0]);
    assert.equal(result.total, 12);
    assert.equal(result.totalPages, 3);
    assert.equal(result.items.length, page === 3 ? 2 : 5);
    combined.push(...result.items.map(row => row.item.id));
  }
  assert.deepEqual(combined, fixtureIds.sort());
  const repeated = await listEquipmentPage(query, databases[1]);
  assert.deepEqual(repeated.items.map(row => row.item.id), combined.slice(0, 5));
  assert.equal((await listEquipmentPage({ ...query, query: "%_" }, databases[0])).total, 12);
  assert.equal((await listEquipmentPage({ ...query, query: "__" }, databases[0])).total, 0);
  assert.equal((await listEquipmentPage({ ...query, query: "khong-co-ket-qua" }, databases[0])).total, 0);
  assert.equal((await listEquipmentPage({ ...query, status: "published" }, databases[0])).total, 0);
  assert.equal((await listEquipmentPage({ ...query, page: 4 }, databases[0])).items.length, 0);
  let writes = 0;
  const controlSnapshot = await listEquipmentPage(query, databaseWithWriteAfterRows(async () => {
    await clients[1]`update sales_equipment set deleted_at=now() where id=${fixtureIds[0]}`;
    writes++;
  }, true));
  assert.equal(writes, 1);
  assert.equal(controlSnapshot.total, 11);
  assert.deepEqual(controlSnapshot.items.map(row => row.item.id), combined.slice(0, 5));
  await clients[1]`update sales_equipment set deleted_at=null where id=${fixtureIds[0]}`;
  writes = 0;
  const snapshot = await listEquipmentPage(query, databaseWithWriteAfterRows(async () => {
    await clients[1]`update sales_equipment set deleted_at=now() where id=${fixtureIds[0]}`;
    writes++;
  }));
  assert.equal(writes, 1);
  assert.equal(snapshot.total, 12);
  assert.deepEqual(snapshot.items.map(row => row.item.id), combined.slice(0, 5));
  assert.equal((await listEquipmentPage(query, databases[0])).total, 11);
  console.log("Đạt: writer commit sau rows trước count; response giữ snapshot 12 mục, request mới thấy 11 mục.");
  await clients[0]`update sales_equipment set deleted_at=now() where id=${fixtureIds[0]}`;
  assert.equal((await listEquipmentPage(query, databases[0])).total, 11);
  const largeSpecifications = [{ title: "Thông số kiểm thử", items: Array.from({ length: 30 }, (_, index) => ({ label: `Thông số ${index}`, value: "Thông số thiết bị. ".repeat(80) })) }];
  await clients[0]`update sales_equipment set specification_groups=${JSON.stringify(largeSpecifications)}::jsonb where group_id=${listGroup}`;
  const measured = await listEquipmentPage({ ...query, pageSize: 25 }, databases[0]);
  const payloadBytes = Buffer.byteLength(JSON.stringify(measured), "utf8");
  const projectedBytes = Buffer.byteLength(JSON.stringify({ ...measured, items: measured.items.map(({ item, group }) => ({ id: item.id, name: item.name, slug: item.slug, modelCode: item.modelCode, status: item.status, version: item.draftVersion, updatedAt: item.updatedAt, groupName: group.name })) }), "utf8");
  assert.equal(measured.items.length, 11);
  assert.ok(payloadBytes > projectedBytes * 10);
  console.log(`Thiết bị: fixture 11 mục có thông số lớn, repository payload ${payloadBytes} byte; projection cột bảng ${projectedBytes} byte. Đây là đo payload fixture, không phải benchmark production hoặc tối ưu đã triển khai.`);
  const stateId = fixtureIds[1];
  const [baseline] = await clients[0]`select * from sales_equipment where id=${stateId}`;
  assert.deepEqual(await changeEquipmentState(stateId, "archive", actorId, 1, databases[0]), { id: stateId, status: "archived", version: 2 });
  await assert.rejects(changeEquipmentState(stateId, "restore", actorId, 1, databases[1]), ContentVersionConflictError);
  assert.deepEqual(await changeEquipmentState(stateId, "restore", actorId, 2, databases[0]), { id: stateId, status: "draft", version: 3 });
  const [restored] = await clients[0]`select * from sales_equipment where id=${stateId}`;
  for (const key of Object.keys(baseline)) {
    if (!["status", "draft_version", "updated_at"].includes(key)) assert.deepEqual(restored[key], baseline[key]);
  }
  const [stateHistory] = await clients[0]`select count(*)::int as total from sales_equipment_revisions where sales_equipment_id=${stateId}`;
  const [stateAudit] = await clients[0]`select count(*)::int as total from audit_logs where entity_id=${stateId}`;
  assert.equal(stateHistory.total, 3);
  assert.equal(stateAudit.total, 3);
  console.log("Đạt: action archive/restore giữ toàn bộ nội dung/thông số; version cũ không ghi; mỗi action có đúng revision/audit.");
  await clients[0]`update equipment_groups set deleted_at=now() where id=${listGroup}`;
  const hidden = await listEquipmentPage(query, databases[0]);
  assert.equal(hidden.total, 0);
  assert.equal(hidden.items.length, 0);
  console.log("Đạt: 12 bản ghi đồng hạng chia ba trang theo ID không lặp/thiếu; đọc lại cùng thứ tự; filter trạng thái/tìm ký tự %_ literal và soft-delete đúng.");
}

async function main() {
try {
  await run();
} catch (error) {
  // Không in SQL/connection string từ lỗi driver.
  const cause = error instanceof Error && error.cause ? error.cause : error;
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "UNKNOWN";
  console.error("Audit DB thiết bị thất bại:", error instanceof assert.AssertionError ? error.message : error instanceof EquipmentVersionConflictError ? error.message : `Kiểm tra DB local và schema hiện tại (mã ${/^[A-Z0-9_]+$/.test(code) ? code : "UNKNOWN"}).`);
  process.exitCode = 1;
} finally {
  await Promise.all(clients.map((client) => client.end({ timeout: 10 })));
  if (created) {
    if (!/^cms_audit_[a-f0-9]{32}$/.test(auditSchema)) throw new Error("Tên schema dọn dẹp không hợp lệ.");
    await control`drop schema ${control(auditSchema)} cascade`;
    const [remaining] = await control`select count(*)::int as total from information_schema.schemata where schema_name = ${auditSchema}`;
    assert.equal(remaining.total, 0);
    console.log("Đã dọn schema kiểm thử riêng; không thay đổi dữ liệu CMS public.");
  }
  await control.end({ timeout: 10 });
}
}

void main().catch(() => {
  console.error("Không thể hoàn tất dọn dẹp audit DB. Kiểm tra schema kiểm thử local trước khi chạy lại.");
  process.exitCode = 1;
});
