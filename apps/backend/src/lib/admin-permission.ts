import { listingPageOwnerModules } from "@iorder/core/server/pages/pages.contract";
import { cmsModules, cmsPermissions, hasAnyCmsPermission, isSuperAdmin, type CmsAction, type CmsActor, type CmsModuleKey, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";

export const adminMutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// First path segment after /api/admin → permission module.
const resourceModules: Record<string, CmsModuleKey> = {
  dashboard: "dashboard",
  "tim-kiem": "dashboard",
  notifications: "dashboard",
  pages: "pages",
  posts: "posts",
  offerings: "offerings",
  equipment: "equipment",
  "support-downloads": "support_downloads",
  supporting: "supporting",
  media: "media",
  taxonomy: "taxonomy",
  navigation: "navigation",
  redirects: "redirects",
  leads: "leads",
  audit: "audit",
  users: "users",
  roles: "roles",
  profile: "settings",
  "publishing-config": "settings",
  "external-links": "settings",
};

export const revisionTargetModules = {
  posts: "posts",
  offerings: "offerings",
  pages: "pages",
  equipment: "equipment",
  navigation: "navigation",
  downloads: "support_downloads",
} as const satisfies Record<string, CmsModuleKey>;

// POST on these resources creates or updates depending on body.id; the route
// handler narrows the check to the exact action.
const upsertResources = new Set(["pages", "equipment", "supporting", "taxonomy", "redirects", "users", "roles"]);

const methodActions: Record<string, CmsAction> = { GET: "view", HEAD: "view", POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };

function permissionsFor(module: CmsModuleKey, actions: CmsAction[]): CmsPermissionCode[] {
  const allowed = cmsModules.find((item) => item.key === module)?.actions as readonly CmsAction[] | undefined;
  return actions.filter((action) => allowed?.includes(action)).map((action) => `${module}.${action}` as CmsPermissionCode);
}

// Returns the permissions of which the actor needs at least one; an empty list
// means Super Admin only (unknown resource or an action the module lacks).
// Returns null for endpoints that handle their own auth: session (login/logout) and account (any signed-in user
// changes their own password).
export function requiredAdminPermissions(pathname: string, method: string): CmsPermissionCode[] | null {
  const segments = pathname.replace(/^\/api\/admin\/?/, "").split("/").filter(Boolean);
  const resource = segments[0] ?? "";
  if (resource === "session" || resource === "account") return null;
  // Xem trước bản nháp: route tự kiểm quyền xem đúng module của nội dung; ở đây chỉ cần có quyền xem một trong các module đó.
  if (resource === "preview") return method.toUpperCase() === "POST" ? [...permissionsFor("posts", ["view"]), ...permissionsFor("pages", ["view"]), ...permissionsFor("offerings", ["view"]), ...listingPageOwnerModules.flatMap((module) => permissionsFor(module, ["view"]))] : [];

  const action = methodActions[method.toUpperCase()];
  if (!action) return [];

  if (resource === "revisions") {
    const targetModule = revisionTargetModules[segments[1] as keyof typeof revisionTargetModules];
    return targetModule ? permissionsFor(targetModule, [action === "view" ? "view" : "update"]) : [];
  }

  // Dashboard, global search and notifications filter every section by permission themselves; any view right opens them.
  if ((resource === "dashboard" || resource === "tim-kiem" || resource === "notifications") && action === "view") return cmsPermissions.filter((permission) => permission.code.endsWith(".view")).map((permission) => permission.code);

  const resourceModule = resourceModules[resource];
  if (!resourceModule) return [];
  const required = permissionsFor(resourceModule, action === "create" && upsertResources.has(resource) ? ["create", "update"] : [action]);
  // Listing pages (/tin-tuc, /thiet-bi…) are also editable by their owning module;
  // the pages route handler narrows this to the exact page.
  if (resource === "pages" && (action === "view" || action === "create")) {
    return [...required, ...listingPageOwnerModules.flatMap((module) => permissionsFor(module, [action === "view" ? "view" : "update"]))];
  }
  return required;
}

export function actorMayAccess(actor: CmsActor, required: readonly CmsPermissionCode[]) {
  return required.length ? hasAnyCmsPermission(actor, required) : isSuperAdmin(actor);
}
