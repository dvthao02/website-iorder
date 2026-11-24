import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@iorder/shared/db/client";
import { auditLogs, contactLeads, equipmentGroups, permissions, rolePermissions, roles, salesEquipment, userRoles, users } from "@iorder/shared/db/schema";
import { superAdminRoleCode } from "@iorder/shared/server/auth/permissions";
import { leadOverdueHours } from "../dashboard/notifications.contract";
import { parseLeadContext, type LeadAssignee, type LeadContext, type LeadExportQuery, type LeadListQuery, type LeadStatus, type LeadUpdate, type PublicLeadInput } from "./leads.contract";
import { toAdminListPage, vietnamDayRange } from "../shared/admin-list.contract";
import { listOrder, vietnameseText } from "../shared/list-order";
import { liveContentCondition } from "../shared/live-content";
import { equipmentIdOfContext, evaluateLeadCooldown, evaluatePhoneLimit, hasSameDevice, isDuplicateLead, leadIpDeviceLimit } from "./leads.guard";
import { mergeLeadNote, mergedLeadStatus } from "./leads.merge";
import { normalizePhone } from "./leads.phone";
import { evaluateLeadRateLimit, leadRateLimitWindowMs } from "./leads.rate-limit";

// handled_by và assigned_to cùng trỏ vào users: dùng bí danh để nối hai lần lấy tên người xử lý và người phụ trách.
const handlers = alias(users, "lead_handlers");
const assignees = alias(users, "lead_assignees");

// Cột đọc cho danh sách và tệp xuất; nơi dùng phải left join `handlers` và `assignees`.
const leadRowFields = {
  id: contactLeads.id, name: contactLeads.name, phone: contactLeads.phone, email: contactLeads.email, businessModel: contactLeads.businessModel, branches: contactLeads.branches,
  need: contactLeads.need, message: contactLeads.message, status: contactLeads.status, createdAt: contactLeads.createdAt, handledAt: contactLeads.handledAt, context: contactLeads.context,
  internalNote: contactLeads.internalNote, handledByName: handlers.fullName,
  assignedToId: contactLeads.assignedTo, assignedToName: assignees.fullName, assignedAt: contactLeads.assignedAt,
};
// Số liên hệ cùng số điện thoại (kể cả chính nó, không tính liên hệ đã xóa) để nhận ra khách gửi lại; liên hệ cũ chưa có phone_digits tính là 1.
// Bảng ngoài viết rõ tên vì bảng trong đặt bí danh.
const sameCustomerCount = sql<number>`greatest(1, (select count(*)::int from contact_leads as same_phone where same_phone.phone_digits = "contact_leads"."phone_digits" and same_phone.deleted_at is null))`;

/** Cột context là JSONB: đọc qua schema để thành LeadContext hoặc null. */
const withLeadContext = <T extends { context: unknown }>(row: T) => ({ ...row, context: parseLeadContext(row.context) });

// Liên hệ đã xóa (rác, đã gộp) không hiện ở CMS; dòng vẫn nằm trong bảng (đã xóa thông tin cá nhân) để giới hạn chống spam đếm đủ.
const leadVisible = isNull(contactLeads.deletedAt);

// Khoảng ngày áp cho cả danh sách, bộ đếm theo trạng thái và file CSV.
function leadDateRange(query: { from?: string; to?: string }) {
  const { start, end } = vietnamDayRange(query.from, query.to);
  return and(start ? gte(contactLeads.createdAt, start) : undefined, end ? lt(contactLeads.createdAt, end) : undefined);
}

function leadOrder(query: { sort?: string; dir?: "asc" | "desc" }) {
  return listOrder({ createdAt: contactLeads.createdAt, name: vietnameseText(contactLeads.name) }, query, [desc(contactLeads.createdAt), asc(contactLeads.id)]);
}

/** Nguồn liên hệ: hỏi mua một thiết bị (có context) hay liên hệ chung. */
function leadSource(source: LeadListQuery["source"]) {
  if (source === "equipment") return isNotNull(contactLeads.context);
  if (source === "general") return isNull(contactLeads.context);
  return undefined;
}

/** Người phụ trách: "me" là tài khoản đang xem (không biết tài khoản thì không khớp liên hệ nào). */
function leadAssignee(filter: LeadListQuery["assignee"], actorId: string | null) {
  if (filter === "all") return undefined;
  if (filter === "unassigned") return isNull(contactLeads.assignedTo);
  if (filter === "me") return actorId ? eq(contactLeads.assignedTo, actorId) : sql`false`;
  return eq(contactLeads.assignedTo, filter);
}

/**
 * Chỉ hiện nhóm cần chú ý: "overdue" là liên hệ Mới đã chờ quá `leadOverdueHours` giờ; "repeat" là khách đã gửi từ 2 liên hệ trở lên cùng một số điện thoại.
 * Áp cho cả danh sách lẫn bộ đếm trạng thái (như các bộ lọc khác), nên số trên các tab là số trong nhóm đang xem.
 */
function leadFocus(focus: LeadListQuery["focus"]) {
  if (focus === "overdue") return and(eq(contactLeads.status, "new"), lt(contactLeads.createdAt, new Date(Date.now() - leadOverdueHours * 60 * 60 * 1000)));
  if (focus === "repeat") return sql`${sameCustomerCount} > 1`;
  return undefined;
}

function leadSearch(query: string | undefined) {
  const keyword = query ? `%${query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  // Tìm theo số điện thoại bất kể cách viết: gõ 0964350515 vẫn ra liên hệ lưu +84 964 350 515, gõ +84 964 cũng ra số 0964….
  const digits = (query ?? "").replace(/\D/g, "");
  const phoneDigits = digits.length >= 3 ? or(ilike(contactLeads.phoneDigits, `%${digits}%`), ilike(contactLeads.phoneDigits, `%${digits.replace(/^(?:00)?84/, "0")}%`)) : undefined;
  return keyword ? or(ilike(contactLeads.name, keyword), ilike(contactLeads.phone, keyword), phoneDigits, ilike(contactLeads.email, keyword), ilike(contactLeads.businessModel, keyword), ilike(contactLeads.need, keyword), sql`${contactLeads.context}->>'name' ilike ${keyword}`, sql`${contactLeads.context}->>'modelCode' ilike ${keyword}`) : undefined;
}

/**
 * Nhân viên có thể được giao liên hệ: tài khoản đang hoạt động, chưa xóa, là Super Admin hoặc có quyền leads.update (người chỉ xem không đổi được
 * trạng thái hay ghi chú nên không xử lý được liên hệ đã giao cho mình).
 * `onlyUserId` kiểm tra riêng một tài khoản (trả mảng rỗng nếu không đủ điều kiện).
 */
export async function listLeadAssignees(database = getDb(), onlyUserId?: string): Promise<LeadAssignee[]> {
  const rows = await database.selectDistinct({ id: users.id, name: users.fullName }).from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(isNull(users.deletedAt), eq(users.status, "active"), onlyUserId ? eq(users.id, onlyUserId) : undefined, or(eq(roles.code, superAdminRoleCode), eq(permissions.code, "leads.update"))));
  return rows.sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/**
 * Danh sách liên hệ: lọc theo trạng thái, nguồn, người phụ trách, từ khóa, khoảng ngày. `actorId` là tài khoản đang xem, dùng cho bộ lọc "của tôi".
 * Kèm danh sách nhân viên có thể được giao để CMS dựng ô chọn người phụ trách.
 */
export async function listLeadsPage(query: LeadListQuery, database = getDb(), actorId: string | null = null) {
  const search = and(leadVisible, leadSearch(query.query), leadDateRange(query), leadSource(query.source), leadAssignee(query.assignee, actorId), leadFocus(query.focus));
  const assignable = await listLeadAssignees(database);
  // Một snapshot cho hàng, tổng và bộ đếm; không để chúng lệch khi có mutation đồng thời.
  return database.transaction(async tx => {
    const condition = and(search, query.status === "all" ? undefined : eq(contactLeads.status, query.status));
    const rows = await tx.select({ ...leadRowFields, sameCustomerCount }).from(contactLeads)
      .leftJoin(handlers, eq(contactLeads.handledBy, handlers.id)).leftJoin(assignees, eq(contactLeads.assignedTo, assignees.id)).where(condition)
      .orderBy(...leadOrder(query)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const items = rows.map(withLeadContext);
    const counts = { all: 0, new: 0, contacted: 0, closed: 0 };
    const totals = await tx.select({ status: contactLeads.status, total: count() }).from(contactLeads).where(search).groupBy(contactLeads.status);
    for (const row of totals) { counts[row.status] = row.total; counts.all += row.total; }
    return { ...toAdminListPage(items, query, counts[query.status]), counts, assignees: assignable };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

/** Một liên hệ cho khung chi tiết (mở từ thông báo, kể cả khi nó không nằm ở trang đang xem); undefined nếu không có hoặc đã xóa. */
export async function getLeadDetail(id: string, database = getDb()) {
  const [row] = await database.select({ ...leadRowFields, sameCustomerCount }).from(contactLeads)
    .leftJoin(handlers, eq(contactLeads.handledBy, handlers.id)).leftJoin(assignees, eq(contactLeads.assignedTo, assignees.id))
    .where(and(eq(contactLeads.id, id), leadVisible)).limit(1);
  return row ? withLeadContext(row) : undefined;
}

/** Phần nội dung liên hệ được lưu: bỏ các trường chỉ dùng để kiểm tra (ô bẫy, mã phiên, mã thiết bị) khỏi dữ liệu khách. */
export type LeadValues = Omit<PublicLeadInput, "website" | "token" | "equipmentSlug">;

export type CreateLeadResult =
  | { accepted: true; id: string | null; duplicate: boolean }
  | { accepted: false; reason: "rate_limited"; retryAfterSeconds: number; scope: "ip" | "phone" | "cooldown" }
  // Cùng số (hoặc cùng IP quá 2 lần/giờ) đã hỏi mua đúng thiết bị này: từ chối rõ ràng để khách biết yêu cầu trước đã được ghi nhận.
  | { accepted: false; reason: "same_device" };

/**
 * Thiết bị khách hỏi mua, đọc lúc gửi: tên, mã, giá và tình trạng hàng LÚC ĐÓ để nhân viên biết khách hỏi về hàng ở trạng thái nào.
 * Chỉ thiết bị đang hiện trên website; không tìm thấy thì trả null (liên hệ vẫn được lưu như liên hệ chung).
 */
export async function findLeadEquipment(slug: string, database = getDb()): Promise<LeadContext | null> {
  const now = new Date();
  const [row] = await database.select({
    id: salesEquipment.id, slug: salesEquipment.slug, name: salesEquipment.name, modelCode: salesEquipment.modelCode, brand: salesEquipment.brand,
    groupName: equipmentGroups.name, priceVnd: salesEquipment.priceVnd, availability: salesEquipment.availability,
  }).from(salesEquipment).innerJoin(equipmentGroups, eq(salesEquipment.groupId, equipmentGroups.id))
    .where(and(eq(salesEquipment.slug, slug), isNull(salesEquipment.deletedAt), isNull(equipmentGroups.deletedAt), eq(equipmentGroups.isEnabled, true), liveContentCondition(salesEquipment, now)))
    .limit(1);
  if (!row) return null;
  return { kind: "equipment", equipmentId: row.id, slug: row.slug, name: row.name, modelCode: row.modelCode, brand: row.brand, groupName: row.groupName, priceVnd: Number(row.priceVnd), availability: row.availability, capturedAt: now.toISOString() };
}

// Lưu liên hệ qua các lớp chống spam theo thứ tự rẻ đến đắt, tất cả trong một giao dịch có khóa để hai request song song không cùng lọt qua phép đếm:
//   1. IP đã băm: tối đa `leadRateLimitMax` liên hệ trong cửa sổ giới hạn, và cùng một thiết bị tối đa `leadIpDeviceLimit` lần mỗi giờ.
//      Không biết IP (ipHash null) thì bỏ qua lớp này.
//   2. Một số điện thoại chỉ hỏi mua một thiết bị (theo mã thiết bị) một lần trong 24 giờ: lần thứ hai bị từ chối rõ ràng (same_device).
//   3. Liên hệ chung trùng (cùng số, cùng lời nhắn, 24 giờ): nhận là đã gửi nhưng không lưu thêm dòng.
//   4. Hai liên hệ liên tiếp của cùng số phải cách nhau `leadCooldownMs`.
//   5. Giới hạn theo từng số điện thoại (leads.guard.ts), bất kể IP.
export async function createRateLimitedLead(values: LeadValues, ipHash: string | null, context: LeadContext | null = null, database = getDb()): Promise<CreateLeadResult> {
  const equipmentId = context?.equipmentId ?? null;
  return database.transaction(async (tx) => {
    // Khóa luôn theo thứ tự IP rồi tới số điện thoại để hai giao dịch không chờ nhau vòng tròn.
    if (ipHash) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${ipHash}, 0::bigint))`);
      // Lấy giờ SAU khi có khóa: request phải chờ khóa vài trăm ms thì giờ lấy trước đó đã cũ, làm số giây chờ lệch.
      const now = new Date();
      const recent = await tx.select({ createdAt: contactLeads.createdAt, context: contactLeads.context }).from(contactLeads)
        .where(and(eq(contactLeads.ipHash, ipHash), gte(contactLeads.createdAt, new Date(now.getTime() - Math.max(leadRateLimitWindowMs, leadIpDeviceLimit.windowMs)))));
      const decision = evaluateLeadRateLimit(recent.map((row) => row.createdAt), now);
      if (!decision.allowed) return { accepted: false as const, reason: "rate_limited" as const, retryAfterSeconds: decision.retryAfterSeconds, scope: "ip" as const };
      if (equipmentId) {
        const sameDevice = recent.filter((row) => equipmentIdOfContext(row.context) === equipmentId).map((row) => row.createdAt);
        if (!evaluateLeadRateLimit(sameDevice, now, leadIpDeviceLimit.windowMs, leadIpDeviceLimit.max).allowed) return { accepted: false as const, reason: "same_device" as const };
      }
    }

    const phoneDigits = normalizePhone(values.phone);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`lead-phone:${phoneDigits}`}, 0::bigint))`);
    const now = new Date();
    const sameDay = await tx.select({ createdAt: contactLeads.createdAt, message: contactLeads.message, context: contactLeads.context }).from(contactLeads)
      .where(and(eq(contactLeads.phoneDigits, phoneDigits), gte(contactLeads.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000))));
    if (equipmentId && hasSameDevice(sameDay, equipmentId)) return { accepted: false as const, reason: "same_device" as const };
    if (isDuplicateLead(sameDay, { message: values.message, equipmentId })) return { accepted: true as const, id: null, duplicate: true };
    const dates = sameDay.map((row) => row.createdAt);
    const cooldown = evaluateLeadCooldown(dates, now);
    if (!cooldown.allowed) return { accepted: false as const, reason: "rate_limited" as const, retryAfterSeconds: cooldown.retryAfterSeconds, scope: "cooldown" as const };
    const phoneDecision = evaluatePhoneLimit(dates, now);
    if (!phoneDecision.allowed) return { accepted: false as const, reason: "rate_limited" as const, retryAfterSeconds: phoneDecision.retryAfterSeconds, scope: "phone" as const };

    const [lead] = await tx.insert(contactLeads).values({ ...values, ipHash, phoneDigits, context }).returning({ id: contactLeads.id });
    return { accepted: true as const, id: lead.id, duplicate: false };
  });
}

/**
 * Thông tin cá nhân của khách bị xóa khi xóa hoặc gộp liên hệ (quyền riêng tư): chỉ giữ số điện thoại dạng chữ số, IP băm, thiết bị khách hỏi mua và giờ gửi,
 * là những gì giới hạn chống spam cần. Số điện thoại và họ tên là cột bắt buộc nên được thay bằng giá trị trống.
 */
const scrubbedLead = (phoneDigits: string | null) => ({ name: "(đã xóa)", phone: phoneDigits ?? "", email: null, businessModel: null, branches: null, need: null, message: null, internalNote: null, assignedTo: null, assignedAt: null });

/**
 * Xóa nốt thông tin cá nhân của các liên hệ đã bị xóa từ phiên bản cũ (chỉ ẩn, còn giữ tên, email, lời nhắn...). Chạy bằng `pnpm db:cleanup-leads`;
 * liên hệ đã được xóa dữ liệu thì bỏ qua nên chạy lại không sao. Trả về số liên hệ đã dọn.
 */
export async function scrubDeletedLeads(database = getDb()) {
  const rows = await database.update(contactLeads).set({ ...scrubbedLead(null), phone: sql`coalesce(${contactLeads.phoneDigits}, '')` })
    .where(and(isNotNull(contactLeads.deletedAt), ne(contactLeads.name, scrubbedLead(null).name))).returning({ id: contactLeads.id });
  return rows.length;
}

/** Người được giao không phải nhân viên có quyền cập nhật khách hàng tiềm năng (hoặc không còn hoạt động). */
export class LeadAssigneeError extends Error {
  constructor() { super("Người được giao không có quyền cập nhật khách hàng tiềm năng hoặc không còn hoạt động."); }
}

/**
 * Đổi trạng thái, ghi chú nội bộ và/hoặc người phụ trách của một liên hệ trong một giao dịch, ghi nhật ký riêng cho từng thay đổi.
 * Không đổi gì thật sự thì trả về nguyên bản, không ghi nhật ký. Nhật ký ghi chú chỉ ghi độ dài, không ghi nội dung
 * (ghi chú có thể chứa thông tin cá nhân của khách). Liên hệ đã xóa coi như không tồn tại. Người được giao sai thì ném LeadAssigneeError.
 */
export async function updateLead(id: string, patch: LeadUpdate, userId: string, database = getDb()) {
  if (typeof patch.assignedTo === "string" && (await listLeadAssignees(database, patch.assignedTo)).length === 0) throw new LeadAssigneeError();
  return database.transaction(async (tx) => {
    const [before] = await tx.select().from(contactLeads).where(and(eq(contactLeads.id, id), leadVisible)).for("update");
    if (!before) return undefined;
    const statusChanged = patch.status !== undefined && patch.status !== before.status;
    const noteChanged = patch.internalNote !== undefined && patch.internalNote !== before.internalNote;
    const assignmentChanged = patch.assignedTo !== undefined && patch.assignedTo !== before.assignedTo;
    // Thông tin khách: số điện thoại lưu dạng chuẩn và phone_digits (khóa chống spam) đổi theo.
    const contact: Partial<typeof contactLeads.$inferInsert> = {};
    if (patch.name !== undefined && patch.name !== before.name) contact.name = patch.name;
    if (patch.phone !== undefined && patch.phone !== before.phone) Object.assign(contact, { phone: patch.phone, phoneDigits: normalizePhone(patch.phone) });
    if (patch.email !== undefined && patch.email !== before.email) contact.email = patch.email;
    const contactFields = (["name", "phone", "email"] as const).filter((field) => field in contact);
    if (!statusChanged && !noteChanged && !assignmentChanged && contactFields.length === 0) return before;
    const changes: Partial<typeof contactLeads.$inferInsert> = { ...contact };
    if (statusChanged) {
      const handled = patch.status !== "new";
      Object.assign(changes, { status: patch.status, handledAt: handled ? new Date() : null, handledBy: handled ? userId : null });
    }
    if (noteChanged) changes.internalNote = patch.internalNote ?? null;
    if (assignmentChanged) Object.assign(changes, { assignedTo: patch.assignedTo ?? null, assignedAt: patch.assignedTo ? new Date() : null });
    const [after] = await tx.update(contactLeads).set(changes).where(eq(contactLeads.id, id)).returning();
    if (statusChanged) await tx.insert(auditLogs).values({ userId, action: "lead.status_update", entityType: "contact_lead", entityId: id, beforeData: { status: before.status }, afterData: { status: after.status } });
    if (noteChanged) await tx.insert(auditLogs).values({ userId, action: "lead.note_update", entityType: "contact_lead", entityId: id, beforeData: { noteLength: before.internalNote?.length ?? 0 }, afterData: { noteLength: after.internalNote?.length ?? 0 } });
    // Nhật ký chỉ ghi tên các trường đã sửa, không ghi giá trị (họ tên, số điện thoại, email là dữ liệu cá nhân).
    if (contactFields.length > 0) await tx.insert(auditLogs).values({ userId, action: "lead.contact_update", entityType: "contact_lead", entityId: id, beforeData: { fields: contactFields }, afterData: { fields: contactFields } });
    if (assignmentChanged) await tx.insert(auditLogs).values({ userId, action: "lead.assign", entityType: "contact_lead", entityId: id, beforeData: { assignedTo: before.assignedTo }, afterData: { assignedTo: after.assignedTo } });
    return after;
  });
}

export function updateLeadStatus(id: string, status: LeadStatus, userId: string, database = getDb()) {
  return updateLead(id, { status }, userId, database);
}

/**
 * Xóa một liên hệ rác: ẩn khỏi CMS, thông báo và thống kê, đồng thời xóa thông tin cá nhân của khách (`scrubbedLead`). Dòng vẫn nằm trong bảng, chỉ còn
 * số điện thoại dạng chữ số, IP băm và thiết bị, để giới hạn chống spam đếm đủ (xóa hẳn sẽ cho kẻ gửi rác gửi lại ngay). Không hoàn tác được.
 * Nhật ký chỉ ghi trạng thái, không ghi thông tin khách. undefined nếu không có hoặc đã xóa.
 */
export function deleteLead(id: string, userId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    const [before] = await tx.select().from(contactLeads).where(and(eq(contactLeads.id, id), leadVisible)).for("update");
    if (!before) return undefined;
    await tx.update(contactLeads).set({ deletedAt: new Date(), deletedBy: userId, ...scrubbedLead(before.phoneDigits) }).where(eq(contactLeads.id, id));
    await tx.insert(auditLogs).values({ userId, action: "lead.delete", entityType: "contact_lead", entityId: id, beforeData: { status: before.status }, afterData: null });
    return { id };
  });
}

/** Gộp không thực hiện được: có liên hệ không tồn tại (hoặc đã xóa), hoặc các liên hệ không cùng một số điện thoại. */
export class LeadMergeError extends Error {
  constructor(readonly reason: "not_found" | "different_phone") {
    super(reason === "not_found" ? "Có liên hệ không còn tồn tại hoặc đã bị xóa." : "Chỉ gộp được các liên hệ cùng một số điện thoại.");
  }
}

/**
 * Gộp các liên hệ cùng số điện thoại: giữ liên hệ mới nhất, ghi nội dung các liên hệ cũ vào ghi chú của nó (leads.merge.ts) rồi xóa chúng, kể cả thông tin cá nhân (nội dung đã nằm trong ghi chú).
 * Liên hệ giữ lại lấy mức xử lý thấp nhất của cả nhóm và, nếu chưa có người phụ trách, người phụ trách của liên hệ cũ gần nhất có giao.
 */
export function mergeLeads(ids: readonly string[], userId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    const rows = await tx.select().from(contactLeads).where(and(inArray(contactLeads.id, [...ids]), leadVisible)).for("update");
    if (rows.length !== ids.length) throw new LeadMergeError("not_found");
    const phones = new Set(rows.map((row) => row.phoneDigits));
    if (phones.size !== 1 || phones.has(null)) throw new LeadMergeError("different_phone");
    const [kept, ...older] = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    const note = mergeLeadNote(kept.internalNote, older.map((row) => ({ createdAt: row.createdAt, status: row.status, need: row.need, message: row.message, deviceName: parseLeadContext(row.context)?.name ?? null })));
    const status = mergedLeadStatus(rows.map((row) => row.status));
    const inheritedAssignee = kept.assignedTo ?? older.find((row) => row.assignedTo)?.assignedTo ?? null;
    const changes: Partial<typeof contactLeads.$inferInsert> = { internalNote: note || null };
    if (status !== kept.status) Object.assign(changes, { status, handledAt: status === "new" ? null : kept.handledAt, handledBy: status === "new" ? null : kept.handledBy });
    if (inheritedAssignee !== kept.assignedTo) Object.assign(changes, { assignedTo: inheritedAssignee, assignedAt: new Date() });
    await tx.update(contactLeads).set(changes).where(eq(contactLeads.id, kept.id));
    const olderIds = older.map((row) => row.id);
    await tx.update(contactLeads).set({ deletedAt: new Date(), deletedBy: userId, ...scrubbedLead(kept.phoneDigits) }).where(inArray(contactLeads.id, olderIds));
    await tx.insert(auditLogs).values({ userId, action: "lead.merge", entityType: "contact_lead", entityId: kept.id, beforeData: { mergedIds: olderIds }, afterData: { keptId: kept.id, status } });
    return { keptId: kept.id, mergedCount: olderIds.length };
  });
}

// Xuất theo đúng bộ lọc đang xem; ghi nhật ký vì đây là dữ liệu cá nhân của khách hàng.
export async function listLeadsForExport(query: LeadExportQuery, actorId: string, limit: number, database = getDb()) {
  return database.transaction(async tx => {
    const rows = await tx.select(leadRowFields).from(contactLeads)
      .leftJoin(handlers, eq(contactLeads.handledBy, handlers.id)).leftJoin(assignees, eq(contactLeads.assignedTo, assignees.id))
      .where(and(leadVisible, leadSearch(query.query), leadDateRange(query), leadSource(query.source), leadAssignee(query.assignee, actorId), leadFocus(query.focus), query.status === "all" ? undefined : eq(contactLeads.status, query.status)))
      .orderBy(...leadOrder(query)).limit(limit);
    await tx.insert(auditLogs).values({ userId: actorId, action: "lead.export", entityType: "contact_lead", entityId: null, beforeData: null, afterData: { format: query.format, status: query.status, query: query.query ?? null, from: query.from ?? null, to: query.to ?? null, rows: rows.length } });
    return rows.map(withLeadContext);
  });
}
