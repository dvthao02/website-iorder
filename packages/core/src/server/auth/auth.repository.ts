import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { permissions, rolePermissions, roles, sessions, userRoles, users } from "@iorder/core/db/schema";

export async function findActiveAdministratorByUsername(username: string, database = getDb()) {
  const [user] = await database
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      passwordHash: users.passwordHash,
      role: sql<string>`case when bool_or(${roles.code} = 'admin') then 'admin' else min(${roles.code}) end`,
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
  });
}

export async function findActiveAdministratorSession(tokenHash: string, now: Date, database = getDb()) {
  const [session] = await database
    .select({
      sessionId: sessions.id,
      userId: users.id,
      username: users.username,
      fullName: users.fullName,
      expiresAt: sessions.expiresAt,
      role: sql<string>`case when bool_or(${roles.code} = 'admin') then 'admin' else min(${roles.code}) end`,
      permissions: sql<string[]>`coalesce(array_agg(distinct ${permissions.code}) filter (where ${permissions.code} is not null), '{}')`,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.status, "active"),
      ),
    )
    .groupBy(sessions.id, users.id)
    .limit(1);

  return session;
}

export async function revokeSessionByTokenHash(tokenHash: string) {
  await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
}
