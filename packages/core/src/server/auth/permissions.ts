// Permission catalog is code (synced to the `permissions` table by seed-admin);
// roles are data that admins edit in the CMS. A permission is `<module>.<action>`.
export const cmsActionLabels = {
  view: "Xem",
  create: "Tạo",
  update: "Sửa",
  delete: "Xóa",
  publish: "Xuất bản",
} as const;

export type CmsAction = keyof typeof cmsActionLabels;

export const cmsModules = [
  { key: "dashboard", name: "Tổng quan & thống kê", actions: ["view"] },
  { key: "pages", name: "Trang website", actions: ["view", "create", "update", "delete", "publish"] },
  { key: "posts", name: "Bài viết & hướng dẫn", actions: ["view", "create", "update", "delete", "publish"] },
  { key: "offerings", name: "Sản phẩm, giải pháp, dịch vụ, ngành", actions: ["view", "create", "update", "delete", "publish"] },
  { key: "equipment", name: "Thiết bị", actions: ["view", "create", "update", "delete", "publish"] },
  { key: "support_downloads", name: "Tài nguyên hỗ trợ", actions: ["view", "create", "update", "delete", "publish"] },
  { key: "supporting", name: "Đối tác & đánh giá", actions: ["view", "create", "update", "delete", "publish"] },
  { key: "media", name: "Hình ảnh & tệp", actions: ["view", "create", "update", "delete"] },
  { key: "taxonomy", name: "Phân loại bài viết", actions: ["view", "create", "update", "delete"] },
  { key: "navigation", name: "Menu", actions: ["view", "update"] },
  { key: "settings", name: "Cấu hình website", actions: ["view", "update"] },
  { key: "redirects", name: "Chuyển hướng", actions: ["view", "create", "update", "delete"] },
  { key: "leads", name: "Khách hàng tiềm năng", actions: ["view", "update"] },
  { key: "audit", name: "Nhật ký", actions: ["view"] },
  { key: "users", name: "Tài khoản", actions: ["view", "create", "update"] },
  { key: "roles", name: "Vai trò", actions: ["view", "create", "update", "delete"] },
] as const satisfies ReadonlyArray<{ key: string; name: string; actions: readonly CmsAction[] }>;

export type CmsModule = (typeof cmsModules)[number];
export type CmsModuleKey = CmsModule["key"];
export type CmsPermissionCode = { [M in CmsModule as M["key"]]: `${M["key"]}.${M["actions"][number]}` }[CmsModuleKey];

export const cmsPermissions = cmsModules.flatMap((module) => module.actions.map((action) => ({
  code: `${module.key}.${action}` as CmsPermissionCode,
  name: `${cmsActionLabels[action]} — ${module.name}`,
  description: null,
})));

const permissionCodes = new Set<string>(cmsPermissions.map((permission) => permission.code));

export function isCmsPermissionCode(value: string): value is CmsPermissionCode {
  return permissionCodes.has(value);
}

export const superAdminRoleCode = "admin";

function all(...modules: CmsModuleKey[]) {
  return cmsModules.filter((module) => modules.includes(module.key)).flatMap((module) => module.actions.map((action) => `${module.key}.${action}` as CmsPermissionCode));
}
function only(actions: readonly CmsAction[], ...modules: CmsModuleKey[]) {
  return cmsModules.filter((module) => modules.includes(module.key))
    .flatMap((module) => module.actions.filter((action) => actions.includes(action)).map((action) => `${module.key}.${action}` as CmsPermissionCode));
}

const contentModules = ["pages", "posts", "offerings", "equipment", "support_downloads", "supporting", "media", "taxonomy"] as const;

// Defaults are created once; after that admins own each role's permissions.
export const defaultCmsRoles: ReadonlyArray<{ code: string; name: string; description: string; permissions: readonly CmsPermissionCode[] }> = [
  { code: superAdminRoleCode, name: "Super Admin", description: "Toàn quyền hệ thống. Không thể sửa hoặc xóa.", permissions: cmsPermissions.map((permission) => permission.code) },
  { code: "content_manager", name: "Quản lý nội dung", description: "Soạn, xuất bản nội dung và quản lý cấu hình website.", permissions: [...only(["view"], "dashboard"), ...all(...contentModules, "navigation", "settings", "redirects")] },
  { code: "editor", name: "Biên tập viên", description: "Soạn và sửa bản nháp, không xuất bản.", permissions: [...only(["view"], "dashboard"), ...only(["view", "create", "update", "delete"], ...contentModules)] },
  { code: "publisher", name: "Xuất bản viên", description: "Duyệt và xuất bản nội dung.", permissions: [...only(["view"], "dashboard", ...contentModules), ...only(["update", "publish"], "pages", "posts", "offerings", "equipment", "support_downloads")] },
  { code: "marketing", name: "Marketing & SEO", description: "Nội dung, menu, cấu hình và chuyển hướng.", permissions: [...only(["view"], "dashboard"), ...all("pages", "posts", "offerings", "media", "navigation", "settings", "redirects")] },
  { code: "support", name: "Chăm sóc khách hàng", description: "Xử lý khách hàng tiềm năng.", permissions: [...only(["view"], "dashboard", "media"), ...all("leads")] },
  { code: "analyst", name: "Phân tích", description: "Chỉ xem.", permissions: only(["view"], ...cmsModules.map((module) => module.key).filter((key) => key !== "users" && key !== "roles")) },
];

export type CmsActor = { role?: string; permissions: readonly string[] };

export function isSuperAdmin(actor: CmsActor) {
  return actor.role === superAdminRoleCode;
}

export function hasCmsPermission(actor: CmsActor, permission: CmsPermissionCode) {
  return isSuperAdmin(actor) || actor.permissions.includes(permission);
}

export function hasAnyCmsPermission(actor: CmsActor, permissions: readonly CmsPermissionCode[]) {
  return permissions.some((permission) => hasCmsPermission(actor, permission));
}
