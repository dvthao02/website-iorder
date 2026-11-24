import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../packages/shared/src/db/schema";
import type { LeadContext } from "../packages/shared/src/server/leads/leads.contract";
import { createRateLimitedLead, deleteLead, LeadAssigneeError, LeadMergeError, listLeadAssignees, listLeadsForExport, listLeadsPage, mergeLeads, updateLead, updateLeadStatus } from "../packages/shared/src/server/leads/leads.repository";
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
    await client`create table ${client(scope)}.users (like public.users including all)`;
    // Danh sách người có thể được giao đọc qua vai trò và quyền: dựng bản sao các bảng đó trong schema tạm.
    for (const table of ["roles", "user_roles", "permissions", "role_permissions"]) await client`create table ${client(scope)}.${client(table)} (like public.${client(table)} including all)`;
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
    const query = { page: 1, pageSize: 5, query: "", status: "all" as const, source: "all" as const, assignee: "all" as const, focus: "all" as const };
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

    // Ghi chú nội bộ và người xử lý: ghi chú không đổi trạng thái, ghi đúng ghi chú cũ thì không ghi nhật ký, nhật ký chỉ có độ dài (không có nội dung).
    const [staff] = await client`insert into users (username, password_hash, full_name) values ('audit-nhan-vien', 'khong-dung', 'Nhân viên kiểm thử') returning id`;
    const noteLead = filtered.items[1].id;
    const note = "Gọi lúc 9h, khách hẹn gọi lại chiều nay";
    const noted = await updateLead(noteLead, { internalNote: note }, staff.id, db);
    assert.equal(noted?.internalNote, note);
    assert.equal(noted?.status, "new");
    assert.equal(noted?.handledBy, null);
    assert.equal((await updateLead(noteLead, { internalNote: note }, staff.id, db))?.internalNote, note);
    assert.equal((await updateLead(noteLead, {}, staff.id, db))?.internalNote, note);
    const noteAudits = await client`select before_data, after_data from audit_logs where entity_id=${noteLead} and action='lead.note_update'`;
    assert.deepEqual(noteAudits.map(row => [row.before_data, row.after_data]), [[{ noteLength: 0 }, { noteLength: note.length }]]);
    assert.equal(JSON.stringify(noteAudits).includes("hẹn"), false);
    const both = await updateLead(noteLead, { status: "contacted", internalNote: `${note} (đã gọi)` }, staff.id, db);
    assert.equal(both?.status, "contacted");
    assert.equal(both?.handledBy, staff.id);
    const listed = (await listLeadsPage({ ...query, pageSize: 100 }, db)).items.find(row => row.id === noteLead);
    assert.equal(listed?.handledByName, "Nhân viên kiểm thử");
    assert.equal(listed?.internalNote, `${note} (đã gọi)`);
    assert.equal((await updateLead(noteLead, { internalNote: null }, staff.id, db))?.internalNote, null);
    assert.equal((await listLeadsPage({ ...query, pageSize: 100 }, db)).items.find(row => row.id === noteLead)?.internalNote, null);
    assert.equal(await updateLead(randomUUID(), { internalNote: "x" }, staff.id, db), undefined);
    console.log("Đạt: ghi chú nội bộ lưu/xóa độc lập với trạng thái, không ghi nhật ký khi không đổi, nhật ký không chứa nội dung, tên người xử lý lên danh sách.");

    // Nguồn liên hệ, khách gửi lại (cùng số) và tìm theo số điện thoại bất kể cách viết (+84, dấu cách, bỏ số 0 đầu).
    const [beforeSource] = await client`select count(*)::int as total from contact_leads`;
    const sourceContext: LeadContext = { kind: "equipment", equipmentId: randomUUID(), slug: "may-nguon", name: "Máy nguồn", modelCode: null, brand: null, groupName: null, priceVnd: 1_000_000, availability: "in_stock", capturedAt: new Date().toISOString() };
    await client`insert into contact_leads (name, phone, phone_digits, status, created_at) values ('Khách gửi lại', '+84912000999', '0912000999', 'new', '2026-10-11T00:00:00Z')`;
    await client`insert into contact_leads (name, phone, phone_digits, status, created_at, context) values ('Khách gửi lại', '0912 000 999', '0912000999', 'new', '2026-10-12T00:00:00Z', ${JSON.stringify(sourceContext)}::jsonb)`;
    const everything = await listLeadsPage({ ...query, pageSize: 100 }, db);
    assert.equal(everything.total, beforeSource.total + 2);
    assert.equal((await listLeadsPage({ ...query, source: "equipment" }, db)).total, 1);
    assert.equal((await listLeadsPage({ ...query, source: "general" }, db)).total, everything.total - 1);
    assert.deepEqual((await listLeadsPage({ ...query, source: "equipment" }, db)).counts, { all: 1, new: 1, contacted: 0, closed: 0 });
    const repeat = everything.items.filter(row => row.name === "Khách gửi lại");
    assert.deepEqual(repeat.map(row => row.sameCustomerCount), [2, 2]);
    assert.ok(everything.items.filter(row => row.name !== "Khách gửi lại").every(row => row.sameCustomerCount === 1));
    for (const text of ["0912000999", "+84 912 000 999", "84912000999", "912000", "0912 000"]) assert.equal((await listLeadsPage({ ...query, query: text }, db)).total, 2, text);
    assert.equal((await listLeadsPage({ ...query, query: "0912000999", source: "equipment" }, db)).total, 1);
    assert.equal((await listLeadsPage({ ...query, query: "0999999999" }, db)).total, 0);
    // Chỉ hiện: khách gửi nhiều lần (cùng số) và liên hệ Mới chờ quá 24 giờ; bộ đếm trạng thái tính trong nhóm đang xem.
    const repeatOnly = await listLeadsPage({ ...query, focus: "repeat", pageSize: 100 }, db);
    assert.deepEqual(repeatOnly.items.map(row => row.name), ["Khách gửi lại", "Khách gửi lại"]);
    assert.equal(repeatOnly.counts.all, 2);
    await client`insert into contact_leads (name, phone, phone_digits, status, created_at) values ('Khách mới tinh', '0912666777', '0912666777', 'new', now())`;
    const overdueOnly = await listLeadsPage({ ...query, focus: "overdue", pageSize: 100 }, db);
    assert.ok(overdueOnly.total > 0 && overdueOnly.items.every(row => row.status === "new" && new Date(row.createdAt).getTime() < Date.now() - 24 * 3_600_000));
    assert.equal(overdueOnly.items.some(row => row.name === "Khách mới tinh"), false);
    assert.deepEqual([overdueOnly.counts.contacted, overdueOnly.counts.closed], [0, 0]);
    assert.equal((await listLeadsPage({ ...query, focus: "overdue", query: "0912666777" }, db)).total, 0);
    await client`delete from contact_leads where name = 'Khách mới tinh'`;
    console.log("Đạt: lọc theo nguồn (hỏi mua thiết bị / liên hệ chung) kèm bộ đếm, đếm khách gửi lại theo số điện thoại, tìm số bất kể cách viết.");

    // Người phụ trách: chỉ tài khoản hoạt động có quyền sửa khách hàng tiềm năng (hoặc Super Admin) được giao, người chỉ xem thì không; giao/bỏ giao ghi nhật ký; bộ lọc theo người.
    const [support] = await client`insert into roles (code, name) values ('audit-support', 'Chăm sóc khách hàng') returning id`;
    const [noLeads] = await client`insert into roles (code, name) values ('audit-editor', 'Biên tập') returning id`;
    const [adminRole] = await client`insert into roles (code, name) values ('admin', 'Super Admin') returning id`;
    const [updatePermission] = await client`insert into permissions (code, name) values ('leads.update', 'Sửa khách hàng tiềm năng') returning id`;
    const [viewPermission] = await client`insert into permissions (code, name) values ('leads.view', 'Xem khách hàng tiềm năng') returning id`;
    const [otherPermission] = await client`insert into permissions (code, name) values ('posts.view', 'Xem bài viết') returning id`;
    // "Biên tập" chỉ có quyền khác; "Chỉ xem" có leads.view nhưng không có leads.update nên không được giao liên hệ.
    const [viewOnly] = await client`insert into roles (code, name) values ('audit-viewer', 'Chỉ xem') returning id`;
    await client`insert into role_permissions (role_id, permission_id) values (${support.id}, ${updatePermission.id}), (${noLeads.id}, ${otherPermission.id}), (${viewOnly.id}, ${viewPermission.id})`;
    const person = async (username: string, name: string, role: string | null, extra = "") => {
      const [row] = await client`insert into users (username, password_hash, full_name, status) values (${username}, 'khong-dung', ${name}, ${extra || "active"}) returning id`;
      if (role) await client`insert into user_roles (user_id, role_id) values (${row.id}, ${role})`;
      return row.id as string;
    };
    const lan = await person("audit-lan", "Chị Lan", support.id);
    const minh = await person("audit-minh", "Anh Minh", adminRole.id);
    const bien = await person("audit-bien", "Biên tập viên", noLeads.id);
    const nghi = await person("audit-nghi", "Đã khóa", support.id, "disabled");
    const chiXem = await person("audit-xem", "Người chỉ xem", viewOnly.id);
    assert.deepEqual((await listLeadAssignees(db)).map(row => row.name), ["Anh Minh", "Chị Lan"]);
    assert.deepEqual((await listLeadAssignees(db, lan)).map(row => row.id), [lan]);
    assert.deepEqual(await listLeadAssignees(db, bien), []);
    assert.deepEqual(await listLeadAssignees(db, nghi), []);
    assert.deepEqual(await listLeadAssignees(db, chiXem), []);
    const assignLead = (await listLeadsPage({ ...query, pageSize: 100 }, db)).items.find(row => row.name === "Khách kiểm thử 100%_" && row.status === "new" && row.assignedToId === null)!.id;
    const assigned = await updateLead(assignLead, { assignedTo: lan }, minh, db);
    assert.equal(assigned?.assignedTo, lan);
    assert.ok(assigned?.assignedAt instanceof Date);
    assert.equal(assigned?.status, "new");
    for (const wrong of [bien, nghi, chiXem, randomUUID()]) await assert.rejects(updateLead(assignLead, { assignedTo: wrong }, minh, db), LeadAssigneeError);
    assert.equal((await updateLead(assignLead, { assignedTo: lan }, minh, db))?.assignedAt?.getTime(), assigned?.assignedAt?.getTime());
    const assignAudits = await client`select before_data, after_data from audit_logs where entity_id=${assignLead} and action='lead.assign'`;
    assert.deepEqual(assignAudits.map(row => [row.before_data, row.after_data]), [[{ assignedTo: null }, { assignedTo: lan }]]);
    const mineOnly = await listLeadsPage({ ...query, pageSize: 100, assignee: "me" }, db, lan);
    assert.deepEqual(mineOnly.items.map(row => [row.id, row.assignedToName]), [[assignLead, "Chị Lan"]]);
    assert.equal(mineOnly.assignees.length, 2);
    assert.equal((await listLeadsPage({ ...query, assignee: "me" }, db, null)).total, 0);
    assert.equal((await listLeadsPage({ ...query, assignee: lan }, db)).total, 1);
    assert.equal((await listLeadsPage({ ...query, assignee: minh }, db)).total, 0);
    const everyone = await listLeadsPage({ ...query, pageSize: 100 }, db);
    assert.equal((await listLeadsPage({ ...query, assignee: "unassigned" }, db)).total, everyone.total - 1);
    assert.equal((await listLeadsForExport({ status: "all", source: "all", assignee: "me", focus: "all", format: "csv" }, lan, 100, db)).length, 1);
    const cleared = await updateLead(assignLead, { assignedTo: null }, minh, db);
    assert.deepEqual([cleared?.assignedTo, cleared?.assignedAt], [null, null]);
    assert.equal((await listLeadsPage({ ...query, assignee: "me" }, db, lan)).total, 0);
    console.log("Đạt: chỉ tài khoản hoạt động có quyền sửa khách hàng tiềm năng (hoặc Super Admin) được giao, người chỉ xem thì không; giao/bỏ giao ghi nhật ký; lọc theo người phụ trách kể cả \"của tôi\" và chưa giao.");

    // Xóa mềm: biến mất khỏi danh sách, bộ đếm, tệp xuất và số liên hệ cùng số; không sửa/xóa lại được; vẫn tính vào giới hạn chống spam.
    const trashPhone = "0912333444";
    const deviceTrash: LeadContext = { ...sourceContext, equipmentId: randomUUID(), slug: "may-rac", name: "Máy rác" };
    const spamInput = { name: "Khách kiểm thử rác", phone: trashPhone, email: null, businessModel: null, branches: null, need: null, message: "quảng cáo" };
    const spam = await createRateLimitedLead(spamInput, "audit-spam-ip", deviceTrash, db);
    assert.equal(spam.accepted, true);
    await client`update contact_leads set created_at = created_at - interval '2 minutes' where phone_digits = ${trashPhone}`;
    const [spamRow] = await client`select id from contact_leads where phone_digits = ${trashPhone}`;
    const beforeTrash = await listLeadsPage({ ...query, pageSize: 100 }, db);
    assert.equal(beforeTrash.items.find(row => row.id === spamRow.id)?.sameCustomerCount, 1);
    assert.deepEqual(await deleteLead(spamRow.id, minh, db), { id: spamRow.id });
    // Xóa liên hệ rác là xóa thông tin cá nhân: chỉ còn số dạng chữ số, IP băm, thiết bị và giờ gửi.
    const [scrubbed] = await client`select name, phone, email, message, need, internal_note, phone_digits, ip_hash, context is not null as has_context from contact_leads where id = ${spamRow.id}`;
    assert.deepEqual(scrubbed, { name: "(đã xóa)", phone: trashPhone, email: null, message: null, need: null, internal_note: null, phone_digits: trashPhone, ip_hash: scrubbed.ip_hash, has_context: true });
    assert.ok(scrubbed.ip_hash);
    assert.equal(await deleteLead(spamRow.id, minh, db), undefined);
    assert.equal(await updateLead(spamRow.id, { status: "closed" }, minh, db), undefined);
    assert.equal(await deleteLead(randomUUID(), minh, db), undefined);
    const afterTrash = await listLeadsPage({ ...query, pageSize: 100 }, db);
    assert.equal(afterTrash.total, beforeTrash.total - 1);
    assert.equal(afterTrash.counts.all, beforeTrash.counts.all - 1);
    assert.equal(afterTrash.items.some(row => row.id === spamRow.id), false);
    assert.equal((await listLeadsPage({ ...query, query: trashPhone }, db)).total, 0);
    assert.equal((await listLeadsForExport({ status: "all", source: "all", assignee: "all", focus: "all", format: "csv" }, minh, 100, db)).some(row => row.name === "Khách kiểm thử rác"), false);
    const [kept] = await client`select deleted_at, deleted_by from contact_leads where id = ${spamRow.id}`;
    assert.ok(kept.deleted_at); // client thô không ép kiểu ngày (drizzle đặt bộ đọc riêng): chỉ cần có giá trị
    assert.equal(kept.deleted_by, minh);
    const trashAudit = await client`select before_data, after_data from audit_logs where entity_id=${spamRow.id} and action='lead.delete'`;
    assert.deepEqual(trashAudit.map(row => [row.before_data, row.after_data]), [[{ status: "new" }, null]]);
    // Gửi lại đúng thiết bị đó vẫn bị chặn: dòng đã xóa vẫn được đếm cho chống spam (xóa hẳn sẽ cho kẻ gửi rác gửi lại ngay).
    assert.deepEqual(await createRateLimitedLead(spamInput, "audit-spam-ip-2", deviceTrash, db), { accepted: false, reason: "same_device" });
    console.log("Đạt: xóa mềm ẩn khỏi danh sách, bộ đếm, tìm kiếm và tệp xuất, không sửa/xóa lại được, nhật ký không chứa thông tin khách, vẫn chặn gửi lại cùng thiết bị.");

    // Gộp: giữ liên hệ mới nhất, ghi liên hệ cũ vào ghi chú, lấy mức xử lý thấp nhất, thừa hưởng người phụ trách; chỉ gộp cùng số điện thoại.
    const mergePhone = "0912555666";
    const mergeContext: LeadContext = { ...sourceContext, equipmentId: randomUUID(), slug: "may-gop", name: "Máy gộp", priceVnd: 2_000_000 };
    const mergeIds: string[] = [];
    for (const [hoursAgo, message, status, context] of [[30, "Hỏi giá phần mềm", "new", null], [20, "Cần báo giá máy", "contacted", mergeContext], [1, "Gọi lại giúp em", "closed", null]] as const) {
      const [row] = await client`insert into contact_leads (name, phone, phone_digits, message, status, context, created_at, handled_at) values ('Khách gộp', ${mergePhone}, ${mergePhone}, ${message}, ${status}, ${context ? JSON.stringify(context) : null}::jsonb, now() - ${hoursAgo} * interval '1 hour', ${status === "new" ? null : new Date().toISOString()}::timestamptz) returning id`;
      mergeIds.push(row.id);
    }
    await updateLead(mergeIds[1], { assignedTo: lan, internalNote: "Đã báo giá qua Zalo" }, minh, db);
    const [differentPhone] = await client`insert into contact_leads (name, phone, phone_digits) values ('Khách khác số', '0912777888', '0912777888') returning id`;
    await assert.rejects(mergeLeads([mergeIds[0], differentPhone.id], minh, db), (error: unknown) => error instanceof LeadMergeError && error.reason === "different_phone");
    await assert.rejects(mergeLeads([mergeIds[0], randomUUID()], minh, db), (error: unknown) => error instanceof LeadMergeError && error.reason === "not_found");
    await assert.rejects(mergeLeads([spamRow.id, mergeIds[0]], minh, db), (error: unknown) => error instanceof LeadMergeError && error.reason === "not_found");
    const merged = await mergeLeads(mergeIds, minh, db);
    assert.deepEqual(merged, { keptId: mergeIds[2], mergedCount: 2 });
    const [keptLead] = await client`select status, handled_at, handled_by, assigned_to, internal_note from contact_leads where id = ${mergeIds[2]}`;
    assert.equal(keptLead.status, "new");
    assert.equal(keptLead.handled_at, null);
    assert.equal(keptLead.assigned_to, lan);
    assert.ok(keptLead.internal_note.includes("— Gộp từ 2 liên hệ cùng số điện thoại —"));
    assert.ok(keptLead.internal_note.includes("hỏi mua Máy gộp"));
    assert.ok(keptLead.internal_note.includes("Hỏi giá phần mềm"));
    // Liên hệ cũ đã gộp cũng bị xóa thông tin cá nhân (nội dung đã nằm trong ghi chú của liên hệ giữ lại).
    const [mergedOld] = await client`select name, message, internal_note, assigned_to from contact_leads where id = ${mergeIds[1]}`;
    assert.deepEqual(mergedOld, { name: "(đã xóa)", message: null, internal_note: null, assigned_to: null });
    const afterMerge = await listLeadsPage({ ...query, query: mergePhone, pageSize: 100 }, db);
    assert.deepEqual(afterMerge.items.map(row => [row.id, row.sameCustomerCount]), [[mergeIds[2], 1]]);
    const [goneRows] = await client`select count(*)::int as total from contact_leads where id in ${client([mergeIds[0], mergeIds[1]])} and deleted_at is not null and deleted_by = ${minh}`;
    assert.equal(goneRows.total, 2);
    const mergeAudit = await client`select before_data, after_data from audit_logs where entity_id=${mergeIds[2]} and action='lead.merge'`;
    assert.deepEqual(mergeAudit.map(row => [row.before_data, row.after_data]), [[{ mergedIds: [mergeIds[1], mergeIds[0]] }, { keptId: mergeIds[2], status: "new" }]]);
    await assert.rejects(mergeLeads(mergeIds, minh, db), (error: unknown) => error instanceof LeadMergeError && error.reason === "not_found");
    // Sửa thông tin khách: số điện thoại lưu dạng chuẩn và phone_digits đổi theo; nhật ký chỉ ghi tên trường.
    const editedPhone = "0912888999";
    const edited = await updateLead(mergeIds[2], { name: "Khách đã sửa", phone: editedPhone, email: "khach@iorder.vn" }, minh, db);
    assert.deepEqual([edited?.name, edited?.phone, edited?.phoneDigits, edited?.email], ["Khách đã sửa", editedPhone, editedPhone, "khach@iorder.vn"]);
    assert.equal((await listLeadsPage({ ...query, query: editedPhone }, db)).total, 1);
    assert.equal((await listLeadsPage({ ...query, query: mergePhone }, db)).total, 0);
    const contactAudits = await client`select before_data, after_data from audit_logs where entity_id=${mergeIds[2]} and action='lead.contact_update'`;
    assert.deepEqual(contactAudits.map(row => row.after_data), [{ fields: ["name", "phone", "email"] }]);
    assert.equal(JSON.stringify(contactAudits).includes("iorder.vn"), false);
    console.log("Đạt: gộp giữ liên hệ mới nhất, ghi liên hệ cũ vào ghi chú, lấy mức xử lý thấp nhất, thừa hưởng người phụ trách, từ chối khác số hoặc liên hệ đã xóa, nhật ký ghi rõ.");
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
