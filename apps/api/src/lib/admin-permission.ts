import { listingPageOwnerModules } from "@iorder/shared/server/pages/pages.contract";
import { transferDatasetModules } from "@iorder/shared/server/data-transfer/data-transfer.contract";
import { cmsModules, cmsPermissions, hasAnyCmsPermission, isSuperAdmin, type CmsAction, type CmsActor, type CmsModuleKey, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";

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
  // Cùng quyền với màn "Kiểm tra xuất bản" chứa nó; service tự lọc nội dung theo quyền xem từng module.
  "seo-audit": "settings",
  // Trạng thái sao lưu (chỉ đọc) là thông tin vận hành, cùng quyền với cài đặt hệ thống.
  backup: "settings",
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
  if (resource === "builder-preview") return method.toUpperCase() === "POST" ? [...permissionsFor("pages", ["view", "create"]), ...permissionsFor("offerings", ["view", "create"]), ...permissionsFor("equipment", ["view", "create"]), ...listingPageOwnerModules.flatMap(module => permissionsFor(module, ["view"]))] : [];
  // Xem trước bản nháp: route tự kiểm quyền xem đúng module của nội dung; ở đây chỉ cần có quyền xem một trong các module đó.
  if (resource === "preview") return method.toUpperCase() === "POST" ? [...permissionsFor("posts", ["view"]), ...permissionsFor("pages", ["view"]), ...permissionsFor("offerings", ["view"]), ...listingPageOwnerModules.flatMap((module) => permissionsFor(module, ["view"]))] : [];

  const action = methodActions[method.toUpperCase()];
  if (!action) return [];

  if (resource === "revisions") {
    const targetModule = revisionTargetModules[segments[1] as keyof typeof revisionTargetModules];
    const revisionAction = action === "view" ? "view" : "update";
    if (!targetModule) return [];
    // Trang danh sách (/tin-tuc, /thiet-bi…) cũng do module sở hữu sửa; route tự thu hẹp theo slug của trang.
    if (targetModule === "pages") return [...permissionsFor("pages", [revisionAction]), ...listingPageOwnerModules.flatMap((module) => permissionsFor(module, [revisionAction]))];
    return permissionsFor(targetModule, [revisionAction]);
  }

  // Dashboard, global search and notifications filter every section by permission themselves; any view right opens them.
  if ((resource === "dashboard" || resource === "tim-kiem" || resource === "notifications") && action === "view") return cmsPermissions.filter((permission) => permission.code.endsWith(".view")).map((permission) => permission.code);

  // Xuất/nhập file theo bảng: quyền của module sở hữu bảng (xuất = view; nhập = create hoặc update, route kiểm từng dòng).
  if (resource === "data-transfer") {
    const transferModule = transferDatasetModules[segments[1] as keyof typeof transferDatasetModules];
    if (!transferModule) return [];
    return action === "view" ? permissionsFor(transferModule, ["view"]) : action === "create" ? permissionsFor(transferModule, ["create", "update"]) : [];
  }

  // Chuyên mục/thẻ là danh mục chọn trong editor bài viết: người sửa bài cần đọc được, còn tạo/sửa/xóa vẫn cần taxonomy.*.
  if (resource === "taxonomy" && action === "view") return [...permissionsFor("taxonomy", ["view"]), ...permissionsFor("posts", ["view"])];

  const resourceModule = resourceModules[resource];
  if (!resourceModule) return [];
  const required = permissionsFor(resourceModule, action === "create" && upsertResources.has(resource) ? ["create", "update"] : [action]);
  // Listing pages (/tin-tuc, /thiet-bi…) are also editable by their owning module;
  // the pages route handler narrows this to the exact page.
  // PATCH (đổi trạng thái) cũng vậy: route kiểm đúng quyền sửa + xuất bản theo slug của trang.
  if (resource === "pages" && (action === "view" || action === "create" || action === "update")) {
    return [...required, ...listingPageOwnerModules.flatMap((module) => permissionsFor(module, [action === "view" ? "view" : "update"]))];
  }
  return required;
}

export function actorMayAccess(actor: CmsActor, required: readonly CmsPermissionCode[]) {
  return required.length ? hasAnyCmsPermission(actor, required) : isSuperAdmin(actor);
}
