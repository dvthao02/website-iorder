import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { adminNotificationStates } from "@iorder/shared/db/schema";
import { notificationStateRetentionDays, type NotificationState } from "./notification-state";

/** Mọi trạng thái thông báo đã nhớ của một người, theo mã thông báo. */
export async function listNotificationStates(userId: string, database = getDb()): Promise<Map<string, NotificationState>> {
  const rows = await database.select({ key: adminNotificationStates.notificationKey, fingerprint: adminNotificationStates.fingerprint, state: adminNotificationStates.state })
    .from(adminNotificationStates).where(eq(adminNotificationStates.userId, userId));
  return new Map(rows.map((row) => [row.key, { fingerprint: row.fingerprint, state: row.state }]));
}

/** Ghi (hoặc ghi đè) trạng thái đã đọc/đã xóa cho các thông báo; đọc rồi xóa thì dòng chuyển sang "đã xóa". */
export async function saveNotificationStates(userId: string, entries: ReadonlyArray<{ key: string; fingerprint: string; state: NotificationState["state"] }>, database = getDb()) {
  if (entries.length === 0) return;
  await database.insert(adminNotificationStates)
    .values(entries.map((entry) => ({ userId, notificationKey: entry.key, fingerprint: entry.fingerprint, state: entry.state })))
    .onConflictDoUpdate({
      target: [adminNotificationStates.userId, adminNotificationStates.notificationKey],
      set: { fingerprint: sql`excluded.fingerprint`, state: sql`excluded.state`, updatedAt: sql`now()` },
    });
}

/** Quên trạng thái của các thông báo (đánh dấu chưa đọc): chúng trở lại như chưa từng đọc. */
export async function forgetNotificationStates(userId: string, keys: readonly string[], database = getDb()) {
  if (keys.length === 0) return;
  await database.delete(adminNotificationStates).where(and(eq(adminNotificationStates.userId, userId), inArray(adminNotificationStates.notificationKey, [...keys])));
}

/** Dọn trạng thái cũ hơn thời hạn giữ của người này (thông báo đó thường đã hết hiệu lực từ lâu). */
export async function purgeOldNotificationStates(userId: string, now = new Date(), database = getDb()) {
  const before = new Date(now.getTime() - notificationStateRetentionDays * 24 * 60 * 60 * 1000);
  await database.delete(adminNotificationStates).where(and(eq(adminNotificationStates.userId, userId), lt(adminNotificationStates.updatedAt, before)));
}
