import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, roles, sessions, userRoles, users } from "@iorder/core/db/schema";
import { userAuditSnapshot } from "./user-audit";
import { assertActiveAdministratorRemains } from "./user-admin-policy";
import { CmsUserPermissionError } from "./users.errors";
import { cmsRoles, type CmsRoleCode } from "../auth/permissions";
import type { CmsUserListQuery } from "./users.contract";
import { toAdminListPage } from "../shared/admin-list.contract";

export async function listCmsUsersPage(query: CmsUserListQuery, database = getDb()) {
  return database.transaction(async tx => {
    const members = tx.select({
      id: users.id, username: users.username, email: users.email, fullName: users.fullName,
      status: users.status, lastLoginAt: users.lastLoginAt,
      role: sql<CmsRoleCode>`case when bool_or(${roles.code} = 'admin') then 'admin' else min(${roles.code}) end`.as("cms_role"),
    }).from(users).innerJoin(userRoles, eq(userRoles.userId, users.id)).innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(sql`${roles.code} in (${sql.join(cmsRoles.map((role) => sql`${role.code}`), sql`, `)})`).groupBy(users.id).as("cms_members");
    const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
    const condition = and(
      query.status === "all" ? undefined : eq(members.status, query.status),
      query.role === "all" ? undefined : eq(members.role, query.role),
      keyword ? or(ilike(members.username, keyword), ilike(members.fullName, keyword), ilike(members.email, keyword)) : undefined,
    );
    const items = await tx.select().from(members).where(condition).orderBy(asc(members.username), asc(members.id))
      .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(members).where(condition);
    const [counts] = await tx.select({
      all: count(),
      active: sql<number>`count(*) filter (where ${members.status} = 'active')::int`,
      admins: sql<number>`count(*) filter (where ${members.status} = 'active' and ${members.role} = 'admin')::int`,
    }).from(members);
    return { ...toAdminListPage(items, query, totals.total), counts };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export function listCmsUsers(database = getDb()) {
  return database.select({
    id: users.id, username: users.username, email: users.email,
    fullName: users.fullName, status: users.status, lastLoginAt: users.lastLoginAt,
    role: sql<string>`case when bool_or(${roles.code} = 'admin') then 'admin' else 'editor' end`,
  }).from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(sql`${roles.code} in ('admin', 'editor')`)
    .groupBy(users.id)
    .orderBy(asc(users.username), asc(users.id));
}
export async function writeCmsUser(id: string | null, values: { username: string; email: string | null; fullName: string; role: CmsRoleCode; status: "active" | "disabled"; passwordHash?: string }, actorId: string, database = getDb()) {
  return database.transaction(async tx => {
    // Mọi mutation CMS user khóa cùng dòng role trước khi đọc/ghi user.
    // Nhờ đó count admin và cập nhật role/status không bị hai transaction vượt qua đồng thời.
    const [adminRole] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.code, "admin")).for("update");
    if (!adminRole) throw new Error("Vai trò quản trị viên chưa được khởi tạo.");
    // Cùng khóa role với mọi mutation tài khoản: quyền không đổi giữa kiểm tra và ghi.
    const [actor] = await tx.select({ id: users.id }).from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(and(eq(users.id, actorId), eq(users.status, "active"), eq(userRoles.roleId, adminRole.id)))
      .limit(1);
    if (!actor) throw new CmsUserPermissionError();
    const [editorRole] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.code, values.role)).limit(1);
    if (!editorRole) throw new Error("Vai trò CMS chưa được khởi tạo.");
    const [before] = id ? await tx.select().from(users).where(eq(users.id, id)).for("update") : [];
    if (id && !before) return undefined;
    if (before?.status === "active" && (values.role !== "admin" || values.status !== "active")) {
      const [membership] = await tx.select({ userId: userRoles.userId }).from(userRoles)
        .where(and(eq(userRoles.userId, before.id), eq(userRoles.roleId, adminRole.id))).limit(1);
      if (membership) {
        const [count] = await tx.select({ total: sql<number>`count(*)::int` }).from(users)
          .innerJoin(userRoles, eq(userRoles.userId, users.id))
          .where(and(eq(users.status, "active"), eq(userRoles.roleId, adminRole.id)));
        assertActiveAdministratorRemains(true, false, count?.total ?? 0);
      }
    }
    const { passwordHash, role, ...userValues } = values;
    const [saved] = id
      ? await tx.update(users).set({ ...userValues, ...(passwordHash ? { passwordHash } : {}), updatedAt: new Date() }).where(eq(users.id, id)).returning()
      : await tx.insert(users).values({ ...userValues, passwordHash: passwordHash! }).returning();
    await tx.delete(userRoles).where(eq(userRoles.userId, saved.id));
    await tx.insert(userRoles).values({ userId: saved.id, roleId: editorRole.id });
    if (id && values.status === "disabled") await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, id), sql`${sessions.revokedAt} is null`));
    await tx.insert(auditLogs).values({ userId: actorId, action: id ? "user.update" : "user.create", entityType: "user", entityId: saved.id,
      beforeData: userAuditSnapshot(before), afterData: { ...userAuditSnapshot(saved), role, passwordChanged: Boolean(passwordHash) } });
    return saved.id;
  });
}
