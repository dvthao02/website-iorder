import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { auditLogs, permissions, rolePermissions, roles, userRoles, users } from "@iorder/core/db/schema";

import { superAdminRoleCode, type CmsPermissionCode } from "../auth/permissions";
import type { CmsRoleInput } from "./roles.contract";
import { accessErrors } from "./roles.errors";

export type CmsTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export type ActorAccess = { superRoleId: string; isSuperAdmin: boolean; roleIds: Set<string>; permissions: Set<string> };

// Every role/user access change locks the Super Admin role row first, so
// permission checks, last-admin counts and writes cannot interleave.
export async function loadActorAccess(tx: CmsTransaction, actorId: string): Promise<ActorAccess> {
  const [superRole] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.code, superAdminRoleCode)).for("update");
  if (!superRole) throw new Error("Vai trò Super Admin chưa được khởi tạo.");
  const rows = await tx.select({ roleId: userRoles.roleId, permission: permissions.code }).from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(users.id, actorId), eq(users.status, "active")));
  if (!rows.length) throw accessErrors.notAllowed();
  const roleIds = new Set(rows.map((row) => row.roleId));
  return {
    superRoleId: superRole.id,
    isSuperAdmin: roleIds.has(superRole.id),
    roleIds,
    permissions: new Set(rows.flatMap((row) => row.permission ? [row.permission] : [])),
  };
}

export function requireActorPermission(access: ActorAccess, permission: CmsPermissionCode) {
  if (!access.isSuperAdmin && !access.permissions.has(permission)) throw accessErrors.notAllowed();
}

// A non-Super-Admin may only hand out permissions they hold themselves.
export function assertCanGrant(access: ActorAccess, granted: Iterable<string>) {
  if (access.isSuperAdmin) return;
  for (const code of granted) if (!access.permissions.has(code)) throw accessErrors.escalation();
}

export async function rolePermissionCodes(tx: CmsTransaction, roleId: string) {
  const rows = await tx.select({ code: permissions.code }).from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId)).where(eq(rolePermissions.roleId, roleId));
  return rows.map((row) => row.code).sort();
}

export function listCmsRoles(database = getDb()) {
  const userCounts = database.select({ roleId: userRoles.roleId, total: sql<number>`count(*)::int`.as("total") })
    .from(userRoles).groupBy(userRoles.roleId).as("role_user_counts");
  return database.select({
    id: roles.id, code: roles.code, name: roles.name, description: roles.description, isSystem: roles.isSystem,
    permissions: sql<string[]>`coalesce(array_agg(distinct ${permissions.code}) filter (where ${permissions.code} is not null), '{}')`,
    userCount: sql<number>`coalesce(max(${userCounts.total}), 0)::int`,
  }).from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .leftJoin(userCounts, eq(userCounts.roleId, roles.id))
    .groupBy(roles.id)
    .orderBy(desc(roles.isSystem), asc(roles.name), asc(roles.id));
}

export async function writeCmsRole(id: string | null, values: CmsRoleInput, actorId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    const access = await loadActorAccess(tx, actorId);
    requireActorPermission(access, id ? "roles.update" : "roles.create");

    const [before] = id ? await tx.select().from(roles).where(eq(roles.id, id)).for("update") : [];
    if (id && !before) throw accessErrors.roleNotFound();
    if (before?.isSystem) throw accessErrors.protectedRole();
    if (before && !access.isSuperAdmin && access.roleIds.has(before.id)) throw accessErrors.ownRole();

    const beforePermissions = before ? await rolePermissionCodes(tx, before.id) : [];
    assertCanGrant(access, values.permissions.filter((code) => !beforePermissions.includes(code)));

    const [saved] = before
      ? await tx.update(roles).set({ name: values.name, description: values.description, updatedAt: new Date() }).where(eq(roles.id, before.id)).returning()
      : await tx.insert(roles).values({ code: `role_${randomUUID().replaceAll("-", "").slice(0, 12)}`, name: values.name, description: values.description }).returning();

    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, saved.id));
    if (values.permissions.length) {
      const permissionRows = await tx.select({ id: permissions.id }).from(permissions).where(inArray(permissions.code, values.permissions));
      if (permissionRows.length !== values.permissions.length) throw new Error("Danh mục quyền chưa được đồng bộ.");
      await tx.insert(rolePermissions).values(permissionRows.map((row) => ({ roleId: saved.id, permissionId: row.id })));
    }

    await tx.insert(auditLogs).values({
      userId: actorId, action: before ? "role.update" : "role.create", entityType: "role", entityId: saved.id,
      beforeData: before ? { name: before.name, description: before.description, permissions: beforePermissions } : null,
      afterData: { name: saved.name, description: saved.description, permissions: values.permissions },
    });
    return saved.id;
  });
}

export async function deleteCmsRole(id: string, actorId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    const access = await loadActorAccess(tx, actorId);
    requireActorPermission(access, "roles.delete");
    const [before] = await tx.select().from(roles).where(eq(roles.id, id)).for("update");
    if (!before) throw accessErrors.roleNotFound();
    if (before.isSystem) throw accessErrors.protectedRole();
    if (access.roleIds.has(before.id)) throw accessErrors.ownRole();
    const [assigned] = await tx.select({ total: sql<number>`count(*)::int` }).from(userRoles).where(eq(userRoles.roleId, id));
    if (assigned && assigned.total > 0) throw accessErrors.roleInUse(assigned.total);
    const beforePermissions = await rolePermissionCodes(tx, id);
    await tx.delete(roles).where(eq(roles.id, id));
    await tx.insert(auditLogs).values({
      userId: actorId, action: "role.delete", entityType: "role", entityId: id,
      beforeData: { name: before.name, description: before.description, permissions: beforePermissions }, afterData: null,
    });
    return id;
  });
}
