import { count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, errorLogs } from "@iorder/shared/db/schema";
import { toAdminListPage } from "../shared/admin-list.contract";
import { listOrder } from "../shared/list-order";
import { errorLogDetailsSchema, type ErrorLogClearRequest, type ErrorLogItem, type ErrorLogListQuery } from "./error-log.contract";
import type { ErrorLogRecord } from "./error-log.record";

/** Ghi một lỗi: lỗi đã có (cùng dấu vân tay) thì tăng số lần và làm mới lần xảy ra gần nhất, không thêm dòng. */
export async function recordErrorLog(record: ErrorLogRecord, database = getDb()) {
  await database.insert(errorLogs).values(record).onConflictDoUpdate({
    target: errorLogs.fingerprint,
    set: {
      occurrences: sql`${errorLogs.occurrences} + 1`,
      lastSeenAt: sql`now()`,
      errorMessage: record.errorMessage,
      method: record.method,
      path: record.path,
      requestId: record.requestId,
      details: record.details,
    },
  });
}

function filterCondition(query: Pick<ErrorLogListQuery, "query">) {
  if (!query.query) return undefined;
  const keyword = `%${query.query.replace(/[\\%_]/g, "\\$&")}%`;
  return or(ilike(errorLogs.message, keyword), ilike(errorLogs.errorMessage, keyword), ilike(errorLogs.errorName, keyword), ilike(errorLogs.path, keyword), ilike(errorLogs.requestId, keyword));
}

type ErrorLogRow = typeof errorLogs.$inferSelect;
function toItem(row: ErrorLogRow): ErrorLogItem {
  const details = errorLogDetailsSchema.safeParse(row.details);
  return { id: row.id, message: row.message, errorName: row.errorName, errorMessage: row.errorMessage, method: row.method, path: row.path, requestId: row.requestId, occurrences: row.occurrences, firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt, details: details.success ? details.data : { context: {} } };
}

export function listErrorLogsPage(query: ErrorLogListQuery, database = getDb()) {
  const condition = filterCondition(query);
  return database.transaction(async (tx) => {
    const rows = await tx.select().from(errorLogs).where(condition)
      .orderBy(...listOrder({ lastSeenAt: errorLogs.lastSeenAt, occurrences: errorLogs.occurrences }, query, [desc(errorLogs.lastSeenAt), desc(errorLogs.id)]))
      .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [total] = await tx.select({ value: count() }).from(errorLogs).where(condition);
    return toAdminListPage(rows.map(toItem), query, total?.value ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

/** Xóa một dòng hoặc toàn bộ, và để lại một dòng nhật ký hoạt động nói ai xóa, bao nhiêu dòng (cùng giao dịch). */
export function clearErrorLogRows(request: ErrorLogClearRequest, actorId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    const removed = await tx.delete(errorLogs).where(request.mode === "one" ? eq(errorLogs.id, request.id) : undefined).returning({ id: errorLogs.id });
    if (removed.length) {
      await tx.insert(auditLogs).values({ userId: actorId, action: "error_log.delete", entityType: "error_log", entityId: request.mode === "one" ? request.id : null, afterData: { scope: request.mode, deleted: removed.length } });
    }
    return { affected: removed.length };
  });
}
