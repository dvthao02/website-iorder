import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { sessions, users } from "@iorder/shared/db/schema";

// Phiên đăng nhập nằm trong chính database bị phục hồi. Bản sao lưu cũ hơn lần đăng nhập này không có phiên đó, nên
// người bấm "Phục hồi" bị đăng xuất ngay khi xong và không thấy thông báo kết quả. Chụp lại các phiên còn hạn của
// riêng người bấm trước khi đổi database, rồi đưa vào bản phục hồi nếu tài khoản đó vẫn đang hoạt động ở đó.
// Phiên của người khác không được mang theo: bản phục hồi quyết định ai còn đăng nhập được.
export type CarriedSession = typeof sessions.$inferSelect;

export async function snapshotActorSessions(userId: string, now = new Date()): Promise<CarriedSession[]> {
  return getDb().select().from(sessions).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));
}

/** Trả về số phiên đã giữ lại; 0 nếu tài khoản không có hoặc không còn hoạt động trong bản phục hồi (phải đăng nhập lại). */
export async function restoreActorSessions(carried: CarriedSession[]): Promise<number> {
  const [first] = carried;
  if (!first) return 0;
  const [user] = await getDb().select({ id: users.id }).from(users).where(and(eq(users.id, first.userId), eq(users.status, "active"), isNull(users.deletedAt))).limit(1);
  if (!user) return 0;
  // Bản phục hồi có thể đã chứa chính phiên này (id hoặc token trùng): bỏ qua dòng trùng.
  await getDb().insert(sessions).values(carried).onConflictDoNothing();
  return carried.length;
}
