import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, mediaAssets, permissions, rolePermissions, roles, sessions, userRoles, users } from "@iorder/shared/db/schema";

export async function findActiveAdministratorByUsername(username: string, database = getDb()) {
  const [user] = await database
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      passwordHash: users.passwordHash,
      role: sql<string>`case when bool_or(${roles.code} = 'admin') then 'admin' else min(${roles.code}) end`,
      roleName: sql<string>`case when bool_or(${roles.code} = 'admin') then max(${roles.name}) filter (where ${roles.code} = 'admin') else min(${roles.name}) end`,
      permissions: sql<string[]>`coalesce(array_agg(distinct ${permissions.code}) filter (where ${permissions.code} is not null), '{}')`,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(users.username, username),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    // Nếu có cả hai role, quyền admin đã được cấp phải được nhận nhất quán.
    .groupBy(users.id)
    .limit(1);

  return user;
}

export async function createSessionForUser(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
}) {
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.insert(sessions).values(input);
    await tx
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, input.userId));
    await tx.insert(auditLogs).values({ userId: input.userId, action: "user.login", entityType: "user", entityId: input.userId });
  });
}

// Sai mật khẩu với tài khoản có thật. Không ghi tên đăng nhập không tồn tại: người dùng hay gõ nhầm mật khẩu vào ô đó.
export async function recordFailedLogin(userId: string, database = getDb()) {
  await database.insert(auditLogs).values({ userId, action: "user.login_failed", entityType: "user", entityId: userId });
}

export async function findActiveAdministratorSession(tokenHash: string, now: Date, database = getDb()) {
  const [session] = await database
    .select({
      sessionId: sessions.id,
      userId: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      // Khóa lưu trữ của ảnh đại diện còn dùng được (ảnh đã xóa thì coi như chưa có); URL dựng ở auth.service.
      avatarStorageKey: sql<string | null>`max(${mediaAssets.storageKey})`,
      expiresAt: sessions.expiresAt,
      role: sql<string>`case when bool_or(${roles.code} = 'admin') then 'admin' else min(${roles.code}) end`,
      roleName: sql<string>`case when bool_or(${roles.code} = 'admin') then max(${roles.name}) filter (where ${roles.code} = 'admin') else min(${roles.name}) end`,
      permissions: sql<string[]>`coalesce(array_agg(distinct ${permissions.code}) filter (where ${permissions.code} is not null), '{}')`,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .leftJoin(mediaAssets, and(eq(mediaAssets.id, users.avatarMediaId), isNull(mediaAssets.deletedAt)))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .groupBy(sessions.id, users.id)
    .limit(1);

  return session;
}

export async function revokeSessionByTokenHash(tokenHash: string) {
  await getDb().transaction(async (tx) => {
    const [session] = await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
      .returning({ userId: sessions.userId });
    if (session) await tx.insert(auditLogs).values({ userId: session.userId, action: "user.logout", entityType: "user", entityId: session.userId });
  });
}

export async function findActivePasswordHash(userId: string, database = getDb()) {
  const [user] = await database.select({ passwordHash: users.passwordHash }).from(users).where(and(eq(users.id, userId), eq(users.status, "active"), isNull(users.deletedAt))).limit(1);
  return user?.passwordHash;
}

const ownProfileColumns = { fullName: users.fullName, email: users.email, phone: users.phone, avatarMediaId: users.avatarMediaId };

// Cập nhật họ tên, email, số điện thoại của chính mình. Khóa dòng để nhật ký ghi đúng trước/sau; không đổi gì thì không ghi gì.
// Email trùng tài khoản khác ném lỗi 23505 của PostgreSQL để service đổi thành thông báo tiếng Việt.
export async function updateOwnProfile(userId: string, values: { fullName: string; email: string | null; phone: string | null }, database = getDb()) {
  return database.transaction(async (tx) => {
    const [before] = await tx.select(ownProfileColumns).from(users).where(and(eq(users.id, userId), eq(users.status, "active"), isNull(users.deletedAt))).for("update");
    if (!before) return undefined;
    if (before.fullName === values.fullName && before.email === values.email && before.phone === values.phone) return before;
    const [saved] = await tx.update(users).set({ ...values, updatedAt: new Date() }).where(eq(users.id, userId)).returning(ownProfileColumns);
    await tx.insert(auditLogs).values({ userId, action: "user.update", entityType: "user", entityId: userId, beforeData: before, afterData: saved });
    return saved;
  });
}

// Đặt hoặc bỏ ảnh đại diện của chính mình; trả mã ảnh cũ để service dọn khỏi thư viện media.
export async function replaceOwnAvatar(userId: string, avatarMediaId: string | null, database = getDb()) {
  return database.transaction(async (tx) => {
    const [before] = await tx.select({ avatarMediaId: users.avatarMediaId }).from(users).where(and(eq(users.id, userId), eq(users.status, "active"), isNull(users.deletedAt))).for("update");
    if (!before) return undefined;
    await tx.update(users).set({ avatarMediaId, updatedAt: new Date() }).where(eq(users.id, userId));
    await tx.insert(auditLogs).values({ userId, action: "user.update", entityType: "user", entityId: userId, beforeData: { avatarMediaId: before.avatarMediaId }, afterData: { avatarMediaId } });
    return { previousMediaId: before.avatarMediaId };
  });
}

// Đổi mật khẩu, đăng xuất mọi phiên khác của tài khoản (giữ phiên đang dùng) và ghi nhật ký trong cùng transaction.
export async function replaceOwnPassword(userId: string, keepSessionId: string, passwordHash: string, database = getDb()) {
  return database.transaction(async (tx) => {
    const now = new Date();
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, userId));
    const revoked = await tx.update(sessions).set({ revokedAt: now })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), ne(sessions.id, keepSessionId)))
      .returning({ id: sessions.id });
    await tx.insert(auditLogs).values({ userId, action: "user.password_change", entityType: "user", entityId: userId, beforeData: null, afterData: { revokedSessions: revoked.length } });
    return revoked.length;
  });
}
