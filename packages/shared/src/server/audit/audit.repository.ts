import { and, asc, count, desc, eq, gte, ilike, inArray, like, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "@iorder/shared/db/client";
import { auditLogs, users } from "@iorder/shared/db/schema";
import type { AuditListQuery } from "./audit.contract";
import { toAdminListPage, vietnamDayRange } from "../shared/admin-list.contract";
import { listOrder, vietnameseText } from "../shared/list-order";
import { auditLabelSearchCodes } from "./audit-labels";

// So khóa cấp một của before/after ngay trong SQL để danh sách không phải tải cả JSON (khối trang có thể lớn).
const changedFields = sql<string[]>`case when jsonb_typeof(${auditLogs.beforeData}) = 'object' and jsonb_typeof(${auditLogs.afterData}) = 'object' then coalesce((select array_agg(key order by key) from (select key from jsonb_each(${auditLogs.beforeData}) b full join jsonb_each(${auditLogs.afterData}) a using (key) where b.value is distinct from a.value) changed), '{}') when jsonb_typeof(${auditLogs.afterData}) = 'object' then coalesce((select array_agg(key order by key) from jsonb_object_keys(${auditLogs.afterData}) key), '{}') else '{}' end`;
const auditListFields = { id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt, userName: users.fullName, userUsername: users.username, ipAddress: auditLogs.ipAddress, userAgent: auditLogs.userAgent, requestId: auditLogs.requestId, changedFields };

type AuditFilter = Pick<AuditListQuery, "query" | "entityType" | "userId" | "verb" | "from" | "to">;

// Điều kiện lọc dùng chung cho danh sách và cho "xóa theo bộ lọc": hai nơi phải khớp từng chữ, để số dòng người dùng
// thấy trong danh sách đúng bằng số dòng sẽ bị xóa. Có tham chiếu bảng users (tìm theo tên người thực hiện).
function auditFilterCondition(filter: AuditFilter) {
  const keyword = filter.query ? `%${filter.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const labels = auditLabelSearchCodes(filter.query);
  const { start, end } = vietnamDayRange(filter.from, filter.to);
  return and(filter.entityType ? eq(auditLogs.entityType, filter.entityType) : undefined,
    filter.userId ? eq(auditLogs.userId, filter.userId) : undefined,
    filter.verb ? like(auditLogs.action, `%.${filter.verb}`) : undefined,
    start ? gte(auditLogs.createdAt, start) : undefined, end ? lt(auditLogs.createdAt, end) : undefined,
    keyword ? or(ilike(auditLogs.action, keyword), ilike(auditLogs.entityType, keyword), ilike(users.fullName, keyword), ilike(users.username, keyword), ilike(auditLogs.ipAddress, keyword), labels.actions.length ? inArray(auditLogs.action, labels.actions) : undefined, labels.entityTypes.length ? inArray(auditLogs.entityType, labels.entityTypes) : undefined) : undefined);
}

export function listAuditLogsPage(query: AuditListQuery, database = getDb()) {
  const condition = auditFilterCondition(query);
  return database.transaction(async tx => {
    const items = await tx.select(auditListFields)
      .from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(condition).orderBy(...listOrder({ createdAt: auditLogs.createdAt, action: auditLogs.action, entityType: auditLogs.entityType, user: vietnameseText(users.fullName), ipAddress: auditLogs.ipAddress }, query, [desc(auditLogs.createdAt), desc(auditLogs.id)])).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [total] = await tx.select({ value: count() }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(condition);
    return toAdminListPage(items, query, total?.value ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export function listAuditLogs(limit = 200) {
  return getDb().select(auditListFields)
    .from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(limit);
}

// Người từng có thao tác trong nhật ký: nguồn cho bộ lọc "Người thực hiện" mà không cần quyền xem tài khoản.
export function listAuditActors(database = getDb()) {
  return database.selectDistinct({ id: users.id, fullName: users.fullName, username: users.username })
    .from(auditLogs).innerJoin(users, eq(auditLogs.userId, users.id)).orderBy(asc(users.fullName), asc(users.id));
}

export const auditPurgeAction = "audit.purge";

export type AuditPurgeScope =
  | { mode: "selected"; ids: string[] }
  | { mode: "filtered"; filter: AuditFilter }
  | { mode: "older_than"; cutoff: Date; days: number }
  | { mode: "all" };

/**
 * Xóa (hoặc chỉ đếm khi dryRun) các dòng nhật ký theo phạm vi, rồi ghi MỘT dòng audit.purge nói rõ ai xóa, lúc nào, phạm vi
 * nào, bao nhiêu dòng — cùng một giao dịch nên không có chuyện xóa mà không để lại dấu vết. Chính các dòng audit.purge không
 * bao giờ bị xóa (kể cả khi chọn "toàn bộ"), để luôn truy được lịch sử dọn nhật ký.
 */
export function purgeAuditLogRows(input: { scope: AuditPurgeScope; dryRun: boolean; actorId: string }, database = getDb()) {
  return database.transaction(async (tx) => {
    const { scope } = input;
    const matching = scope.mode === "selected" ? inArray(auditLogs.id, scope.ids)
      : scope.mode === "older_than" ? lt(auditLogs.createdAt, scope.cutoff)
      // Bộ lọc có thể tham chiếu bảng users (tìm theo tên): đi qua truy vấn con vì DELETE không JOIN được.
      : scope.mode === "filtered" ? inArray(auditLogs.id, tx.select({ id: auditLogs.id }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(auditFilterCondition(scope.filter)))
      : undefined;
    const condition = and(ne(auditLogs.action, auditPurgeAction), matching);
    if (input.dryRun) {
      const [row] = await tx.select({ value: count() }).from(auditLogs).where(condition);
      return { affected: row?.value ?? 0 };
    }
    const removed = await tx.execute<{ affected: number }>(sql`with removed as (delete from audit_logs where ${condition} returning 1) select count(*)::int as affected from removed`);
    const affected = removed[0]?.affected ?? 0;
    const detail = scope.mode === "selected" ? { selectedCount: scope.ids.length }
      : scope.mode === "filtered" ? { filter: scope.filter }
      : scope.mode === "older_than" ? { keepDays: scope.days, cutoff: scope.cutoff.toISOString() }
      : {};
    await tx.insert(auditLogs).values({ userId: input.actorId, action: auditPurgeAction, entityType: "audit", entityId: null, afterData: { scope: scope.mode, deleted: affected, ...detail } });
    return { affected };
  });
}
