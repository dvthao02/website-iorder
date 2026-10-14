import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, users } from "@iorder/core/db/schema";
import type { AuditListQuery } from "./audit.contract";
import { toAdminListPage } from "../shared/admin-list.contract";
import { auditLabelSearchCodes } from "./audit-labels";

export function listAuditLogsPage(query: AuditListQuery, database = getDb()) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const labels = auditLabelSearchCodes(query.query);
  const condition = and(query.entityType ? eq(auditLogs.entityType, query.entityType) : undefined,
    keyword ? or(ilike(auditLogs.action, keyword), ilike(auditLogs.entityType, keyword), ilike(users.fullName, keyword), ilike(users.username, keyword), labels.actions.length ? inArray(auditLogs.action, labels.actions) : undefined, labels.entityTypes.length ? inArray(auditLogs.entityType, labels.entityTypes) : undefined) : undefined);
  return database.transaction(async tx => {
    const items = await tx.select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt, userName: users.fullName, userUsername: users.username })
      .from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(condition).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [total] = await tx.select({ value: count() }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).where(condition);
    return toAdminListPage(items, query, total?.value ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export function listAuditLogs(limit = 200) {
  return getDb().select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt, userName: users.fullName, userUsername: users.username })
    .from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(limit);
}
