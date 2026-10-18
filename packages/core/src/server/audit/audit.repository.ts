import { and, asc, count, desc, eq, gte, ilike, inArray, like, lt, or, sql } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, users } from "@iorder/core/db/schema";
import type { AuditListQuery } from "./audit.contract";
import { toAdminListPage, vietnamDayRange } from "../shared/admin-list.contract";
import { listOrder, vietnameseText } from "../shared/list-order";
import { auditLabelSearchCodes } from "./audit-labels";

// So khóa cấp một của before/after ngay trong SQL để danh sách không phải tải cả JSON (khối trang có thể lớn).
const changedFields = sql<string[]>`case when jsonb_typeof(${auditLogs.beforeData}) = 'object' and jsonb_typeof(${auditLogs.afterData}) = 'object' then coalesce((select array_agg(key order by key) from (select key from jsonb_each(${auditLogs.beforeData}) b full join jsonb_each(${auditLogs.afterData}) a using (key) where b.value is distinct from a.value) changed), '{}') when jsonb_typeof(${auditLogs.afterData}) = 'object' then coalesce((select array_agg(key order by key) from jsonb_object_keys(${auditLogs.afterData}) key), '{}') else '{}' end`;
const auditListFields = { id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt, userName: users.fullName, userUsername: users.username, ipAddress: auditLogs.ipAddress, userAgent: auditLogs.userAgent, requestId: auditLogs.requestId, changedFields };

export function listAuditLogsPage(query: AuditListQuery, database = getDb()) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const labels = auditLabelSearchCodes(query.query);
  const { start, end } = vietnamDayRange(query.from, query.to);
  const condition = and(query.entityType ? eq(auditLogs.entityType, query.entityType) : undefined,
    query.userId ? eq(auditLogs.userId, query.userId) : undefined,
    query.verb ? like(auditLogs.action, `%.${query.verb}`) : undefined,
    start ? gte(auditLogs.createdAt, start) : undefined, end ? lt(auditLogs.createdAt, end) : undefined,
    keyword ? or(ilike(auditLogs.action, keyword), ilike(auditLogs.entityType, keyword), ilike(users.fullName, keyword), ilike(users.username, keyword), ilike(auditLogs.ipAddress, keyword), labels.actions.length ? inArray(auditLogs.action, labels.actions) : undefined, labels.entityTypes.length ? inArray(auditLogs.entityType, labels.entityTypes) : undefined) : undefined);
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
