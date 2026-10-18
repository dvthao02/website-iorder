import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, roles, sessions, userRoles, users } from "@iorder/core/db/schema";
import { userAuditSnapshot } from "./user-audit";
import { assertActiveAdministratorRemains } from "./user-admin-policy";
import { superAdminRoleCode } from "../auth/permissions";
import { assertCanGrant, loadActorAccess, requireActorPermission, rolePermissionCodes } from "../roles/roles.repository";
import { accessErrors } from "../roles/roles.errors";
import type { CmsUserListQuery } from "./users.contract";
import { toAdminListPage } from "../shared/admin-list.contract";
import { listOrder, vietnameseText } from "../shared/list-order";

export async function listCmsUsersPage(query: CmsUserListQuery, database = getDb()) {
  return database.transaction(async tx => {
    const members = tx.select({
      id: users.id, username: users.username, email: users.email, fullName: users.fullName,
      status: users.status, lastLoginAt: users.lastLoginAt,
      role: sql<string>`case when bool_or(${roles.code} = ${superAdminRoleCode}) then ${superAdminRoleCode} else min(${roles.code}) end`.as("cms_role"),
    }).from(users).innerJoin(userRoles, eq(userRoles.userId, users.id)).innerJoin(roles, eq(roles.id, userRoles.roleId))
      .groupBy(users.id).as("cms_members");
    const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
    const condition = and(
      query.status === "all" ? undefined : eq(members.status, query.status),
      query.role === "all" ? undefined : eq(members.role, query.role),
      keyword ? or(ilike(members.username, keyword), ilike(members.fullName, keyword), ilike(members.email, keyword)) : undefined,
    );
    const items = await tx.select().from(members).where(condition).orderBy(...listOrder({ fullName: vietnameseText(members.fullName), username: members.username, role: sql`"cms_role"`, status: members.status, lastLoginAt: members.lastLoginAt }, query, [asc(members.username), asc(members.id)]))
      .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(members).where(condition);
    const [counts] = await tx.select({
      all: count(),
      active: sql<number>`count(*) filter (where ${members.status} = 'active')::int`,
      admins: sql<number>`count(*) filter (where ${members.status} = 'active' and ${members.role} = ${superAdminRoleCode})::int`,
    }).from(members);
    return { ...toAdminListPage(items, query, totals.total), counts };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export function listCmsUsers(database = getDb()) {
  return database.select({
    id: users.id, username: users.username, email: users.email,
    fullName: users.fullName, status: users.status, lastLoginAt: users.lastLoginAt,
    role: sql<string>`case when bool_or(${roles.code} = ${superAdminRoleCode}) then ${superAdminRoleCode} else min(${roles.code}) end`,
  }).from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .groupBy(users.id)
    .orderBy(asc(users.username), asc(users.id));
}
export async function writeCmsUser(id: string | null, values: { username: string; email: string | null; fullName: string; role: string; status: "active" | "disabled"; passwordHash?: string }, actorId: string, database = getDb()) {
  return database.transaction(async tx => {
    // loadActorAccess khóa dòng role Super Admin: kiểm tra quyền, đếm admin và ghi không bị transaction khác chen vào.
    const access = await loadActorAccess(tx, actorId);
    requireActorPermission(access, id ? "users.update" : "users.create");
    const [targetRole] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.code, values.role)).limit(1);
    if (!targetRole) throw accessErrors.roleNotFound();
    const [before] = id ? await tx.select().from(users).where(eq(users.id, id)).for("update") : [];
    if (id && !before) return undefined;
    const beforeRoleIds = before ? (await tx.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, before.id))).map(row => row.roleId) : [];
    const wasSuperAdmin = beforeRoleIds.includes(access.superRoleId);
    const roleChanged = !beforeRoleIds.includes(targetRole.id) || beforeRoleIds.length !== 1;
    if (id === actorId && (roleChanged || values.status !== "active")) throw accessErrors.self();
    if (!access.isSuperAdmin && (wasSuperAdmin || targetRole.id === access.superRoleId)) throw accessErrors.superAdminOnly();
    if (roleChanged) assertCanGrant(access, await rolePermissionCodes(tx, targetRole.id));
    if (before?.status === "active" && wasSuperAdmin && (targetRole.id !== access.superRoleId || values.status !== "active")) {
      const [count] = await tx.select({ total: sql<number>`count(*)::int` }).from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .where(and(eq(users.status, "active"), eq(userRoles.roleId, access.superRoleId)));
      assertActiveAdministratorRemains(true, false, count?.total ?? 0);
    }
    const { passwordHash, role, ...userValues } = values;
    const [saved] = id
      ? await tx.update(users).set({ ...userValues, ...(passwordHash ? { passwordHash } : {}), updatedAt: new Date() }).where(eq(users.id, id)).returning()
      : await tx.insert(users).values({ ...userValues, passwordHash: passwordHash! }).returning();
    await tx.delete(userRoles).where(eq(userRoles.userId, saved.id));
    await tx.insert(userRoles).values({ userId: saved.id, roleId: targetRole.id });
    if (id && values.status === "disabled") await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, id), sql`${sessions.revokedAt} is null`));
    await tx.insert(auditLogs).values({ userId: actorId, action: id ? "user.update" : "user.create", entityType: "user", entityId: saved.id,
      beforeData: userAuditSnapshot(before), afterData: { ...userAuditSnapshot(saved), role, passwordChanged: Boolean(passwordHash) } });
    return saved.id;
  });
}
