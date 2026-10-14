import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/core/src/db/schema";
import { listLeadsPage, updateLeadStatus } from "../packages/core/src/server/leads/leads.repository";
import { submitPublicLead } from "../packages/core/src/server/leads/leads.service";

config({ quiet: true });
const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Audit Leads chỉ chạy PostgreSQL local.");
const scope = `cms_leads_audit_${randomUUID().replaceAll("-", "")}`;
const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const racer = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
const db = drizzle({ client, schema });
const raceDb = drizzle({ client: racer, schema });
let created = false;
async function main() {
  try {
    await client`create schema ${client(scope)}`;
    created = true;
    await client`create table ${client(scope)}.contact_leads (like public.contact_leads including all)`;
    await client`create table ${client(scope)}.audit_logs (like public.audit_logs including all)`;
    await client`select set_config('search_path', ${scope}, false)`;
    await racer`select set_config('search_path', ${scope}, false)`;
    const [current] = await client`select current_schema() as name`;
    assert.equal(current.name, scope);
    const [racerSchema] = await racer`select current_schema() as name`;
    assert.equal(racerSchema.name, scope);
    const ids = Array.from({ length: 12 }, () => randomUUID());
    for (let i = 0; i < ids.length; i++) {
      await client`insert into contact_leads (id, name, phone, status, created_at, ip_hash) values (${ids[i]}, 'Khách kiểm thử 100%_', '0900000000', ${["new", "contacted", "closed"][i % 3]}, '2026-10-10T00:00:00Z', 'khong-duoc-tra')`;
    }
    const query = { page: 1, pageSize: 5, query: "", status: "all" as const };
    const combined: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await listLeadsPage({ ...query, page }, db);
      assert.equal(result.total, 12);
      assert.equal(result.totalPages, 3);
      assert.deepEqual(result.counts, { all: 12, new: 4, contacted: 4, closed: 4 });
      assert.equal(result.items.length, page === 3 ? 2 : 5);
      for (const row of result.items) { assert.equal("ipHash" in row, false); assert.equal("handledBy" in row, false); }
      combined.push(...result.items.map(row => row.id));
    }
    assert.deepEqual(combined, ids.sort());
    const filtered = await listLeadsPage({ ...query, status: "new" }, db);
    assert.equal(filtered.total, 4);
    assert.equal(filtered.items.length, 4);
    assert.ok(filtered.items.every(row => row.status === "new"));
    assert.equal((await listLeadsPage({ ...query, query: "%_" }, db)).total, 12);
    assert.equal((await listLeadsPage({ ...query, query: "__" }, db)).total, 0);
    assert.equal((await listLeadsPage({ ...query, page: 4 }, db)).items.length, 0);
    assert.deepEqual((await listLeadsPage({ ...query, query: "khong-co" }, db)).counts, { all: 0, new: 0, contacted: 0, closed: 0 });
    console.log("Đạt: Leads phân trang đồng hạng không lặp/thiếu, status/tổng/counts đúng, wildcard literal và whitelist đúng.");
    const actor = randomUUID();
    const target = filtered.items[0].id;
    const handled = await updateLeadStatus(target, "contacted", actor, db);
    assert.equal(handled?.handledBy, actor);
    assert.ok(handled?.handledAt instanceof Date);
    const retried = await updateLeadStatus(target, "contacted", randomUUID(), db);
    assert.equal(retried?.handledAt?.getTime(), handled?.handledAt?.getTime());
    assert.equal(retried?.handledBy, actor);
    const after = await listLeadsPage({ ...query, status: "new" }, db);
    assert.equal(after.total, 3);
    assert.deepEqual(after.counts, { all: 12, new: 3, contacted: 5, closed: 4 });
    assert.equal(after.items.some(row => row.id === target), false);
    const reset = await updateLeadStatus(target, "new", actor, db);
    assert.equal(reset?.handledAt, null);
    assert.equal(reset?.handledBy, null);
    assert.equal((await listLeadsPage({ ...query, status: "new" }, db)).total, 4);
    assert.equal(await updateLeadStatus(randomUUID(), "closed", actor, db), undefined);
    const [audit] = await client`select count(*)::int as total from audit_logs`;
    assert.equal(audit.total, 2);
    const history = await client`select before_data, after_data from audit_logs where entity_id=${target} order by created_at`;
    assert.deepEqual(history.map(row => row.before_data), [{ status: "new" }, { status: "contacted" }]);
    assert.deepEqual(history.map(row => row.after_data), [{ status: "contacted" }, { status: "new" }]);
    console.log("Đạt: cập nhật/reset trạng thái thay counts đúng, xử lý đúng timestamp/actor và hai audit chỉ chứa status; ID thiếu không ghi.");
    // Gây lỗi audit có chủ đích trong schema riêng, không thay constraint public.
    await client`alter table audit_logs add constraint reject_lead_audit check (action <> 'lead.status_update') not valid`;
    await assert.rejects(updateLeadStatus(target, "closed", actor, db));
    const [rolledBack] = await client`select status, handled_at, handled_by from contact_leads where id=${target}`;
    assert.deepEqual(rolledBack, { status: "new", handled_at: null, handled_by: null });
    const [unchangedAudit] = await client`select count(*)::int as total from audit_logs`;
    assert.equal(unchangedAudit.total, 2);
    assert.equal((await listLeadsPage({ ...query, status: "new" }, db)).total, 4);
    await client`alter table audit_logs drop constraint reject_lead_audit`;
    const [beforeRateLimit] = await client`select count(*)::int as total from contact_leads`;
    const rateLimitInput = { name: "Khách kiểm thử chống spam", phone: "0900000001", email: "", businessModel: "", branches: "", need: "", message: "", website: "" };
    const concurrent = await Promise.all([
      submitPublicLead(rateLimitInput, "198.51.100.10", db),
      submitPublicLead(rateLimitInput, "198.51.100.10", raceDb),
    ]);
    assert.equal(concurrent.filter(result => result.accepted).length, 1);
    assert.equal(concurrent.filter(result => !result.accepted).length, 1);
    const [afterRateLimit] = await client`select count(*)::int as total from contact_leads`;
    assert.equal(afterRateLimit.total, beforeRateLimit.total + 1);
    console.log("Đạt: hai request cùng IP đồng thời chỉ chính xác một request được ghi trong cửa sổ rate limit.");
    console.log("Đạt: audit insert thất bại rollback trạng thái/timestamp/actor; không lưu nửa chừng hoặc thừa audit.");
  } catch {
    console.error("Audit Leads DB thất bại. Kiểm tra DB local/schema hoặc assertion; không in dữ liệu liên hệ/SQL.");
    process.exitCode = 1;
  } finally {
    if (created) {
      if (!/^cms_leads_audit_[a-f0-9]{32}$/.test(scope)) throw new Error("Schema kiểm thử không hợp lệ.");
      await client`drop schema ${client(scope)} cascade`;
      const [remaining] = await client`select count(*)::int as total from information_schema.schemata where schema_name=${scope}`;
      assert.equal(remaining.total, 0);
      console.log("Đã dọn schema kiểm thử Leads; không thay dữ liệu public.");
    }
    await client.end({ timeout: 10 });
    await racer.end({ timeout: 10 });
  }
}
void main().catch(() => { console.error("Không hoàn tất dọn dẹp audit Leads local."); process.exitCode = 1; });
