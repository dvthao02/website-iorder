import { desc, eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, users } from "@iorder/core/db/schema";

export function listAuditLogs(limit = 200) {
  return getDb().select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt, userName: users.fullName, userUsername: users.username })
    .from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(limit);
}
