import { and, asc, count, desc, eq, gte, ilike, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@iorder/shared/db/client";
import { auditLogs, contactLeads, equipmentGroups, salesEquipment } from "@iorder/shared/db/schema";
import { parseLeadContext, type LeadContext, type LeadExportQuery, type LeadListQuery, type LeadStatus, type PublicLeadInput } from "./leads.contract";
import { toAdminListPage, vietnamDayRange } from "../shared/admin-list.contract";
import { listOrder, vietnameseText } from "../shared/list-order";
import { liveContentCondition } from "../shared/live-content";
import { equipmentIdOfContext, evaluateLeadCooldown, evaluatePhoneLimit, hasSameDevice, isDuplicateLead, leadIpDeviceLimit } from "./leads.guard";
import { normalizePhone } from "./leads.phone";
import { evaluateLeadRateLimit, leadRateLimitWindowMs } from "./leads.rate-limit";

const leadListFields = { id: contactLeads.id, name: contactLeads.name, phone: contactLeads.phone, email: contactLeads.email, businessModel: contactLeads.businessModel, branches: contactLeads.branches, need: contactLeads.need, message: contactLeads.message, status: contactLeads.status, createdAt: contactLeads.createdAt, handledAt: contactLeads.handledAt, context: contactLeads.context };

/** Cột context là JSONB: đọc qua schema để thành LeadContext hoặc null. */
const withLeadContext = <T extends { context: unknown }>(row: T) => ({ ...row, context: parseLeadContext(row.context) });

// Khoảng ngày áp cho cả danh sách, bộ đếm theo trạng thái và file CSV.
function leadDateRange(query: { from?: string; to?: string }) {
  const { start, end } = vietnamDayRange(query.from, query.to);
  return and(start ? gte(contactLeads.createdAt, start) : undefined, end ? lt(contactLeads.createdAt, end) : undefined);
}

function leadOrder(query: { sort?: string; dir?: "asc" | "desc" }) {
  return listOrder({ createdAt: contactLeads.createdAt, name: vietnameseText(contactLeads.name) }, query, [desc(contactLeads.createdAt), asc(contactLeads.id)]);
}

function leadSearch(query: string | undefined) {
  const keyword = query ? `%${query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  return keyword ? or(ilike(contactLeads.name, keyword), ilike(contactLeads.phone, keyword), ilike(contactLeads.email, keyword), ilike(contactLeads.businessModel, keyword), ilike(contactLeads.need, keyword), sql`${contactLeads.context}->>'name' ilike ${keyword}`, sql`${contactLeads.context}->>'modelCode' ilike ${keyword}`) : undefined;
}

export async function listLeadsPage(query: LeadListQuery, database = getDb()) {
  const search = and(leadSearch(query.query), leadDateRange(query));
  // Một snapshot cho hàng, tổng và bộ đếm; không để chúng lệch khi có mutation đồng thời.
  return database.transaction(async tx => {
    const condition = and(search, query.status === "all" ? undefined : eq(contactLeads.status, query.status));
    const rows = await tx.select(leadListFields).from(contactLeads).where(condition)
      .orderBy(...leadOrder(query)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const items = rows.map(withLeadContext);
    const counts = { all: 0, new: 0, contacted: 0, closed: 0 };
    const totals = await tx.select({ status: contactLeads.status, total: count() }).from(contactLeads).where(search).groupBy(contactLeads.status);
    for (const row of totals) { counts[row.status] = row.total; counts.all += row.total; }
    return { ...toAdminListPage(items, query, counts[query.status]), counts };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
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

export function updateLeadStatus(id: string, status: LeadStatus, userId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    const [before] = await tx.select().from(contactLeads).where(eq(contactLeads.id, id)).for("update");
    if (!before) return undefined;
    if (before.status === status) return before;
    const handled = status !== "new";
    const [after] = await tx.update(contactLeads).set({ status, handledAt: handled ? new Date() : null, handledBy: handled ? userId : null }).where(eq(contactLeads.id, id)).returning();
    await tx.insert(auditLogs).values({ userId, action: "lead.status_update", entityType: "contact_lead", entityId: id, beforeData: { status: before.status }, afterData: { status: after.status } });
    return after;
  });
}

// Xuất theo đúng bộ lọc đang xem; ghi nhật ký vì đây là dữ liệu cá nhân của khách hàng.
export async function listLeadsForExport(query: LeadExportQuery, actorId: string, limit: number, database = getDb()) {
  return database.transaction(async tx => {
    const rows = await tx.select(leadListFields).from(contactLeads)
      .where(and(leadSearch(query.query), leadDateRange(query), query.status === "all" ? undefined : eq(contactLeads.status, query.status)))
      .orderBy(...leadOrder(query)).limit(limit);
    await tx.insert(auditLogs).values({ userId: actorId, action: "lead.export", entityType: "contact_lead", entityId: null, beforeData: null, afterData: { format: query.format, status: query.status, query: query.query ?? null, from: query.from ?? null, to: query.to ?? null, rows: rows.length } });
    return rows.map(withLeadContext);
  });
}
