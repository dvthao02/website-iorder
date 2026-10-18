import { eq, inArray, notInArray, sql } from "drizzle-orm";

import { permissions, rolePermissions, roles } from "@iorder/core/db/schema";

import { cmsPermissions, defaultCmsRoles, superAdminRoleCode, type CmsPermissionCode } from "../auth/permissions";
import type { CmsTransaction } from "./roles.repository";

const contentModules = ["pages", "posts", "offerings", "equipment", "support_downloads", "supporting"];
const pick = (modules: string[], actions: string[]) => cmsPermissions
  .filter((permission) => { const [moduleKey, action] = permission.code.split("."); return modules.includes(moduleKey) && actions.includes(action); })
  .map((permission) => permission.code);

// Pre-module codes from the first RBAC draft → current catalog. Used only for
// non-default roles; default roles receive their current defaults instead.
const legacyPermissionMap: Record<string, CmsPermissionCode[]> = {
  "dashboard.read": ["dashboard.view"],
  "analytics.read": ["dashboard.view"],
  "content.read": pick(contentModules, ["view"]),
  "content.write": pick(contentModules, ["create", "update", "delete"]),
  "content.publish": pick(contentModules, ["publish"]),
  "media.manage": pick(["media"], ["view", "create", "update", "delete"]),
  "taxonomy.manage": pick(["taxonomy"], ["view", "create", "update", "delete"]),
  "navigation.manage": pick(["navigation"], ["view", "update"]),
  "seo.manage": pick(["settings", "redirects"], ["view", "create", "update", "delete"]),
  "leads.read": ["leads.view"],
  "leads.write": ["leads.update"],
  "audit.read": ["audit.view"],
  "users.manage": pick(["users"], ["view", "create", "update"]),
  "roles.manage": pick(["roles"], ["view", "create", "update", "delete"]),
};

// Makes the database match the permission catalog in code. Runs on every
// deploy (seed-admin), so it must never override an admin's decisions:
// - permissions removed from the catalog are deleted (their grants cascade);
// - a default role gets its default permissions only when it is created here,
//   or when it held nothing but removed (legacy) codes — the upgrade case;
// - a role an admin emptied on purpose stays empty;
// - Super Admin is always a system role holding every permission.
export async function syncCmsPermissionCatalog(tx: CmsTransaction) {
  const codes = cmsPermissions.map((permission) => permission.code);

  // Roles whose every grant is about to disappear: upgraded from the old catalog.
  const upgraded = await tx.select({ roleId: rolePermissions.roleId, legacyCodes: sql<string[]>`array_agg(${permissions.code})` }).from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .groupBy(rolePermissions.roleId)
    .having(sql`bool_and(${notInArray(permissions.code, codes)})`);
  const upgradedRoleIds = new Set(upgraded.map((row) => row.roleId));

  for (const permission of cmsPermissions) {
    await tx.insert(permissions).values(permission)
      .onConflictDoUpdate({ target: permissions.code, set: { name: permission.name, description: permission.description, updatedAt: new Date() } });
  }
  await tx.delete(permissions).where(notInArray(permissions.code, codes));

  const createdRoleIds = new Set<string>();
  for (const role of defaultCmsRoles) {
    const isSystem = role.code === superAdminRoleCode;
    const [created] = await tx.insert(roles).values({ code: role.code, name: role.name, description: role.description, isSystem })
      .onConflictDoNothing({ target: roles.code }).returning({ id: roles.id });
    if (created) createdRoleIds.add(created.id);
    if (isSystem) await tx.update(roles).set({ name: role.name, description: role.description, isSystem: true, updatedAt: new Date() }).where(eq(roles.code, role.code));
  }

  const permissionRows = await tx.select({ id: permissions.id, code: permissions.code }).from(permissions);
  const permissionIds = new Map(permissionRows.map((row) => [row.code, row.id]));
  const roleRows = await tx.select({ id: roles.id, code: roles.code }).from(roles).where(inArray(roles.code, defaultCmsRoles.map((role) => role.code)));

  for (const role of defaultCmsRoles) {
    const roleId = roleRows.find((row) => row.code === role.code)?.id;
    if (!roleId) throw new Error(`Không tạo được vai trò ${role.code}.`);
    if (role.code !== superAdminRoleCode && !createdRoleIds.has(roleId) && !upgradedRoleIds.has(roleId)) continue;
    for (const code of role.permissions) {
      const permissionId = permissionIds.get(code);
      if (!permissionId) throw new Error(`Không tạo được quyền ${code}.`);
      await tx.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
    }
  }

  // Non-default roles from the old catalog keep equivalent access.
  const defaultRoleIds = new Set(roleRows.map((row) => row.id));
  for (const role of upgraded) {
    if (defaultRoleIds.has(role.roleId)) continue;
    for (const code of new Set(role.legacyCodes.flatMap((legacy) => legacyPermissionMap[legacy] ?? []))) {
      await tx.insert(rolePermissions).values({ roleId: role.roleId, permissionId: permissionIds.get(code)! }).onConflictDoNothing();
    }
  }
}
