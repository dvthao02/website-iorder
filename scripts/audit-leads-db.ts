import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/shared/src/db/schema";
import type { LeadContext } from "../packages/shared/src/server/leads/leads.contract";
import { createRateLimitedLead, listLeadsPage, updateLeadStatus } from "../packages/shared/src/server/leads/leads.repository";
import { issueLeadToken } from "../packages/shared/src/server/leads/leads.guard";
import { leadRateLimitMax, leadRateLimitWindowMs } from "../packages/shared/src/server/leads/leads.rate-limit";
import { submitPublicLead } from "../packages/shared/src/server/leads/leads.service";

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
    // Mã phiên đủ tuổi (cấp cách đây 10 giây) để request qua được lớp kiểm tra mã; xem leads.guard.ts.
    const token = () => issueLeadToken(new Date(Date.now() - 10_000));
    const rateLimitInput = { name: "Khách kiểm thử chống spam", email: "", businessModel: "", branches: "", need: "", message: "", website: "" };
    // Nhiều hơn mức tối đa một request, xen kẽ hai kết nối: khóa advisory phải làm đúng `leadRateLimitMax` request được ghi.
    // Mỗi request một số điện thoại riêng để giới hạn theo IP là lớp duy nhất quyết định (cùng số thì thành liên hệ trùng).
    const concurrent = await Promise.all(Array.from({ length: leadRateLimitMax + 1 }, (_, index) => submitPublicLead({ ...rateLimitInput, phone: `091234567${index}`, token: token() }, "198.51.100.10", index % 2 ? raceDb : db)));
    assert.equal(concurrent.filter(result => result.accepted).length, leadRateLimitMax);
    const rejected = concurrent.filter(result => !result.accepted);
    assert.equal(rejected.length, 1);
    for (const result of rejected) if (!result.accepted && result.kind === "rate_limited") assert.ok(result.retryAfterSeconds >= 1 && result.retryAfterSeconds <= leadRateLimitWindowMs / 1000);
    else assert.fail("Request bị chặn phải là giới hạn theo IP.");
    const [afterRateLimit] = await client`select count(*)::int as total from contact_leads`;
    assert.equal(afterRateLimit.total, beforeRateLimit.total + leadRateLimitMax);
    console.log(`Đạt: ${leadRateLimitMax + 1} request cùng IP đồng thời chỉ chính xác ${leadRateLimitMax} request được ghi trong cửa sổ rate limit, request còn lại nhận số giây phải chờ.`);

    // Các lớp chống spam còn lại, mỗi lần dùng một IP khác để không dính giới hạn theo IP.
    // Lùi giờ các liên hệ của một số điện thoại 2 phút để qua khoảng giãn cách giữa hai liên hệ liên tiếp (30 giây) mà không phải chờ thật.
    const backdate = (digits: string) => client`update contact_leads set created_at = created_at - interval '2 minutes' where phone_digits = ${digits}`;
    const [beforeGuards] = await client`select count(*)::int as total from contact_leads`;
    const phone = "0987654321";
    const first = await submitPublicLead({ ...rateLimitInput, phone, message: "Cần tư vấn máy POS", token: token() }, "198.51.100.21", db);
    assert.deepEqual(first, { accepted: true, duplicate: false, discarded: false });
    // Cùng số (gõ +84, có dấu cách), cùng lời nhắn, đều là liên hệ chung: nhận là đã gửi nhưng không thêm dòng.
    const duplicate = await submitPublicLead({ ...rateLimitInput, phone: "+84 987 654 321", message: "cần tư vấn  máy pos", token: token() }, "198.51.100.22", db);
    assert.deepEqual(duplicate, { accepted: true, duplicate: true, discarded: false });
    const [afterDuplicate] = await client`select count(*)::int as total, count(*) filter (where phone_digits = ${phone})::int as same_phone from contact_leads`;
    assert.equal(afterDuplicate.total, beforeGuards.total + 1);
    assert.equal(afterDuplicate.same_phone, 1);
    // Hai liên hệ liên tiếp (lời nhắn khác nhau nhưng cách nhau chưa tới 30 giây) của cùng số: liên hệ sau bị chặn theo khoảng giãn cách.
    const quick = await submitPublicLead({ ...rateLimitInput, phone, message: "Cần thêm máy in bill", token: token() }, "198.51.100.23", db);
    assert.equal(quick.accepted, false);
    if (!quick.accepted && quick.kind === "rate_limited") { assert.equal(quick.scope, "cooldown"); assert.ok(quick.retryAfterSeconds >= 1 && quick.retryAfterSeconds <= 30); } else assert.fail("Liên hệ liên tiếp phải bị chặn theo khoảng giãn cách.");
    await backdate(phone);
    // Qua khoảng giãn cách thì lời nhắn khác là liên hệ mới: cùng số được tối đa 5 liên hệ trong 30 phút (đã có 1), liên hệ thứ sáu bị chặn theo số điện thoại dù đổi IP.
    for (const [index, message] of ["Cần thêm máy in bill", "Hỏi về bảo hành", "Hỏi giá sỉ", "Cần hóa đơn điện tử"].entries()) {
      assert.equal((await submitPublicLead({ ...rateLimitInput, phone, message, token: token() }, `198.51.100.${30 + index}`, db)).accepted, true, message);
      await backdate(phone);
    }
    const blocked = await submitPublicLead({ ...rateLimitInput, phone, message: "Hỏi thêm về giao hàng", token: token() }, "198.51.100.24", db);
    assert.equal(blocked.accepted, false);
    if (!blocked.accepted && blocked.kind === "rate_limited") assert.equal(blocked.scope, "phone"); else assert.fail("Liên hệ thứ sáu phải bị chặn theo số điện thoại.");
    // Thiếu mã phiên, mã sai, mã mới cấp (gửi quá nhanh): từ chối; ô bẫy có chữ: báo đã nhận nhưng không lưu.
    const noToken = await submitPublicLead({ ...rateLimitInput, phone: "0911111112", message: "a" }, "198.51.100.25", db);
    assert.deepEqual(noToken, { accepted: false, kind: "token", reason: "invalid" });
    const tooFast = await submitPublicLead({ ...rateLimitInput, phone: "0911111112", message: "a", token: issueLeadToken(new Date()) }, "198.51.100.25", db);
    assert.equal(tooFast.accepted, false);
    const bot = await submitPublicLead({ ...rateLimitInput, phone: "0911111113", message: "quảng cáo", website: "http://spam.example", token: token() }, "198.51.100.26", db);
    assert.deepEqual(bot, { accepted: true, duplicate: false, discarded: true });
    const [afterPhoneGuards] = await client`select count(*)::int as total from contact_leads`;
    assert.equal(afterPhoneGuards.total, beforeGuards.total + 5);
    console.log("Đạt: liên hệ trùng không thêm dòng, hai liên hệ liên tiếp bị giãn cách, giới hạn theo số điện thoại chặn dù đổi IP, thiếu mã phiên/gửi quá nhanh bị từ chối, ô bẫy không lưu.");

    // Hỏi mua thiết bị (kiểm theo mã thiết bị, không theo lời nhắn hay slug). Gọi thẳng repository với ngữ cảnh dựng sẵn vì schema tạm không có bảng thiết bị.
    const deviceA: LeadContext = { kind: "equipment", equipmentId: randomUUID(), slug: "may-a", name: "Máy A", modelCode: null, brand: null, groupName: null, priceVnd: 1_000_000, availability: "in_stock", capturedAt: new Date().toISOString() };
    const deviceB: LeadContext = { ...deviceA, equipmentId: randomUUID(), slug: "may-b", name: "Máy B" };
    const lead = (digits: string, message: string) => ({ name: "Khách kiểm thử chống spam", phone: digits, email: null, businessModel: null, branches: null, need: null, message });
    const devicePhone = "0912000111";
    assert.equal((await createRateLimitedLead(lead(devicePhone, "Hỏi giá"), "audit-ip-1", deviceA, db)).accepted, true);
    // Cùng số hỏi lại đúng thiết bị đó (dù đổi lời nhắn, đổi IP, tên thiết bị đã đổi sau đó): từ chối rõ ràng, không lưu.
    assert.deepEqual(await createRateLimitedLead(lead(devicePhone, "Hỏi bảo hành"), "audit-ip-2", { ...deviceA, name: "Máy A (tên mới)", slug: "may-a-moi" }, db), { accepted: false, reason: "same_device" });
    await backdate(devicePhone);
    // Cùng số hỏi thiết bị khác thì được.
    assert.equal((await createRateLimitedLead(lead(devicePhone, "Hỏi giá"), "audit-ip-3", deviceB, db)).accepted, true);
    // Cùng IP hỏi cùng thiết bị bằng số khác: được tối đa 2 lần mỗi giờ, lần thứ ba bị từ chối; IP khác thì vẫn được.
    assert.equal((await createRateLimitedLead(lead("0912000222", "Hỏi giá"), "audit-ip-1", deviceA, db)).accepted, true);
    assert.deepEqual(await createRateLimitedLead(lead("0912000333", "Hỏi giá"), "audit-ip-1", deviceA, db), { accepted: false, reason: "same_device" });
    assert.equal((await createRateLimitedLead(lead("0912000333", "Hỏi giá"), "audit-ip-4", deviceA, db)).accepted, true);
    const [afterDevice] = await client`select count(*)::int as total from contact_leads`;
    assert.equal(afterDevice.total, beforeGuards.total + 5 + 4);
    console.log("Đạt: mỗi số chỉ hỏi một thiết bị một lần (theo mã thiết bị), cùng IP hỏi cùng thiết bị tối đa 2 lần mỗi giờ, thiết bị khác vẫn được.");
    console.log("Đạt: audit insert thất bại rollback trạng thái/timestamp/actor; không lưu nửa chừng hoặc thừa audit.");
  } catch (error) {
    console.error("Audit Leads DB thất bại. Kiểm tra DB local/schema hoặc assertion; không in dữ liệu liên hệ/SQL.");
    // Mặc định im lặng để không in dữ liệu liên hệ; đặt AUDIT_DEBUG=1 khi cần xem lỗi gốc (dữ liệu ở đây chỉ là fixture trong schema tạm).
    if (process.env.AUDIT_DEBUG === "1") console.error(error);
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
