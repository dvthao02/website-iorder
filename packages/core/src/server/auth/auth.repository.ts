import { and, eq, gt, inArray, isNull } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { roles, sessions, userRoles, users } from "@iorder/core/db/schema";

export async function findActiveAdministratorByUsername(username: string) {
  const [user] = await getDb()
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      passwordHash: users.passwordHash,
      role: roles.code,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(users.username, username),
        eq(users.status, "active"),
        inArray(roles.code, ["admin", "editor"]),
      ),
    )
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

export async function findActiveAdministratorSession(tokenHash: string, now: Date) {
  const [session] = await getDb()
    .select({
      sessionId: sessions.id,
      userId: users.id,
      username: users.username,
      fullName: users.fullName,
      expiresAt: sessions.expiresAt,
      role: roles.code,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.status, "active"),
        inArray(roles.code, ["admin", "editor"]),
      ),
    )
    .limit(1);

  return session;
}

export async function revokeSessionByTokenHash(tokenHash: string) {
  await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
}
