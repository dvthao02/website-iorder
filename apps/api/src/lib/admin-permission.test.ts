import assert from "node:assert/strict";
import test from "node:test";

import { cmsPermissions, defaultCmsRoles, isCmsPermissionCode, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";
import { assertCanGrant, type ActorAccess } from "@iorder/shared/server/roles/roles.repository";
import { CmsAccessError } from "@iorder/shared/server/roles/roles.errors";

import { needsPublishPermission } from "./admin-access";
import { actorMayAccess, requiredAdminPermissions } from "./admin-permission";

// One row per admin route and method under apps/api/src/app/api/v1/admin.
const routeTable: Array<[string, string, CmsPermissionCode[] | null]> = [
  ["/api/v1/admin/session", "POST", null],
  ["/api/v1/admin/session", "DELETE", null],
  ["/api/v1/admin/dashboard", "GET", cmsPermissions.map((permission) => permission.code).filter((code) => code.endsWith(".view"))],
  ["/api/v1/admin/tim-kiem", "GET", cmsPermissions.map((permission) => permission.code).filter((code) => code.endsWith(".view"))],
  ["/api/v1/admin/notifications", "GET", cmsPermissions.map((permission) => permission.code).filter((code) => code.endsWith(".view"))],
  ["/api/v1/admin/notifications", "POST", []],
  ["/api/v1/admin/audit", "GET", ["audit.view"]],
  ["/api/v1/admin/users", "GET", ["users.view"]],
  ["/api/v1/admin/users", "POST", ["users.create", "users.update"]],
  ["/api/v1/admin/users", "DELETE", ["users.delete"]],
  ["/api/v1/admin/roles", "GET", ["roles.view"]],
  ["/api/v1/admin/roles", "POST", ["roles.create", "roles.update"]],
  ["/api/v1/admin/roles", "DELETE", ["roles.delete"]],
  ["/api/v1/admin/leads", "GET", ["leads.view"]],
  ["/api/v1/admin/leads/0b5c", "PATCH", ["leads.update"]],
  ["/api/v1/admin/media", "GET", ["media.view"]],
  ["/api/v1/admin/media", "POST", ["media.create"]],
  ["/api/v1/admin/media/0b5c", "PATCH", ["media.update"]],
  ["/api/v1/admin/media/0b5c", "DELETE", ["media.delete"]],
  ["/api/v1/admin/media/0b5c/usage", "GET", ["media.view"]],
  ["/api/v1/admin/taxonomy", "GET", ["taxonomy.view", "posts.view"]],
  ["/api/v1/admin/taxonomy", "POST", ["taxonomy.create", "taxonomy.update"]],
  ["/api/v1/admin/taxonomy", "DELETE", ["taxonomy.delete"]],
  ["/api/v1/admin/navigation", "PUT", ["navigation.update"]],
  ["/api/v1/admin/navigation/targets", "GET", ["navigation.view"]],
  ["/api/v1/admin/redirects", "POST", ["redirects.create", "redirects.update"]],
  ["/api/v1/admin/redirects", "DELETE", ["redirects.delete"]],
  ["/api/v1/admin/publishing-config", "PUT", ["settings.update"]],
  ["/api/v1/admin/external-links", "PUT", ["settings.update"]],
  ["/api/v1/admin/profile", "GET", ["settings.view"]],
  ["/api/v1/admin/seo-audit", "GET", ["settings.view"]],
  ["/api/v1/admin/backup", "GET", ["settings.view"]],
  ["/api/v1/admin/backup", "POST", []],
  ["/api/v1/admin/builder-preview", "GET", []],
  ["/api/v1/admin/builder-preview", "DELETE", []],
  ["/api/v1/admin/data-transfer/equipment", "GET", ["equipment.view"]],
  ["/api/v1/admin/data-transfer/equipment-groups", "POST", ["equipment.create", "equipment.update"]],
  ["/api/v1/admin/data-transfer/offerings-solution", "POST", ["offerings.create", "offerings.update"]],
  ["/api/v1/admin/data-transfer/guides", "GET", ["posts.view"]],
  ["/api/v1/admin/data-transfer/categories", "POST", ["taxonomy.create", "taxonomy.update"]],
  ["/api/v1/admin/data-transfer/testimonials", "POST", ["supporting.create", "supporting.update"]],
  ["/api/v1/admin/data-transfer/redirects", "GET", ["redirects.view"]],
  ["/api/v1/admin/posts/0b5c/word", "GET", ["posts.view"]],
  ["/api/v1/admin/data-transfer/khong-co", "GET", []],
  ["/api/v1/admin/data-transfer/equipment", "DELETE", []],
  // API cũ đã gỡ: chỉ Super Admin qua được proxy (rồi route trả 404).
  ["/api/v1/admin/catalog-content", "PUT", []],
  ["/api/v1/admin/posts", "GET", ["posts.view"]],
  ["/api/v1/admin/posts", "POST", ["posts.create"]],
  ["/api/v1/admin/posts/0b5c", "PATCH", ["posts.update"]],
  ["/api/v1/admin/posts/0b5c", "DELETE", ["posts.delete"]],
  ["/api/v1/admin/offerings", "POST", ["offerings.create"]],
  ["/api/v1/admin/offerings/0b5c", "DELETE", ["offerings.delete"]],
  ["/api/v1/admin/pages", "GET", ["pages.view", "posts.view", "equipment.view", "support_downloads.view", "offerings.view"]],
  ["/api/v1/admin/pages/0b5c", "GET", ["pages.view", "posts.view", "equipment.view", "support_downloads.view", "offerings.view"]],
  ["/api/v1/admin/pages", "POST", ["pages.create", "pages.update", "posts.update", "equipment.update", "support_downloads.update", "offerings.update"]],
  ["/api/v1/admin/pages/0b5c", "PATCH", ["pages.update", "posts.update", "equipment.update", "support_downloads.update", "offerings.update"]],
  ["/api/v1/admin/pages/0b5c", "DELETE", ["pages.delete"]],
  ["/api/v1/admin/equipment", "POST", ["equipment.create", "equipment.update"]],
  ["/api/v1/admin/equipment/0b5c", "PATCH", ["equipment.update"]],
  ["/api/v1/admin/support-downloads", "POST", ["support_downloads.create"]],
  ["/api/v1/admin/support-downloads/0b5c", "PATCH", ["support_downloads.update"]],
  ["/api/v1/admin/supporting", "POST", ["supporting.create", "supporting.update"]],
  ["/api/v1/admin/supporting", "DELETE", ["supporting.delete"]],
  ["/api/v1/admin/revisions/posts/0b5c", "GET", ["posts.view"]],
  ["/api/v1/admin/revisions/posts/0b5c", "POST", ["posts.update"]],
  ["/api/v1/admin/revisions/pages/0b5c", "GET", ["pages.view", "posts.view", "equipment.view", "support_downloads.view", "offerings.view"]],
  ["/api/v1/admin/revisions/pages/0b5c", "POST", ["pages.update", "posts.update", "equipment.update", "support_downloads.update", "offerings.update"]],
  ["/api/v1/admin/revisions/downloads/0b5c", "POST", ["support_downloads.update"]],
  ["/api/v1/admin/revisions/navigation/0b5c", "POST", ["navigation.update"]],
];

test("Mỗi route admin ánh xạ đúng permission", () => {
  for (const [pathname, method, expected] of routeTable) {
    assert.deepEqual(requiredAdminPermissions(pathname, method), expected, `${method} ${pathname}`);
  }
});

test("Route con, dấu / cuối và method chữ thường không làm lỏng quyền", () => {
  assert.deepEqual(requiredAdminPermissions("/api/v1/admin/users/", "GET"), ["users.view"]);
  assert.deepEqual(requiredAdminPermissions("/api/v1/admin/users/0b5c", "PATCH"), ["users.update"]);
  assert.deepEqual(requiredAdminPermissions("/api/v1/admin/posts", "patch"), ["posts.update"]);
});

test("Resource lạ, hành động module không có hoặc revision lạ chỉ Super Admin qua được", () => {
  for (const [pathname, method] of [["/api/v1/admin/khong-ton-tai", "GET"], ["/api/v1/admin/navigation", "DELETE"], ["/api/v1/admin/audit", "DELETE"], ["/api/v1/admin/revisions/la/0b5c", "GET"], ["/api/v1/admin/posts", "OPTIONS"]]) {
    const required = requiredAdminPermissions(pathname, method);
    assert.deepEqual(required, [], `${method} ${pathname}`);
    assert.equal(actorMayAccess({ role: "admin", permissions: [] }, required!), true);
    assert.equal(actorMayAccess({ role: "editor", permissions: cmsPermissions.map((permission) => permission.code) }, required!), false);
  }
});

test("Chỉ endpoint session và account (tự kiểm tra đăng nhập) được bỏ qua kiểm tra quyền", () => {
  assert.equal(requiredAdminPermissions("/api/v1/admin/session", "POST"), null);
  assert.equal(requiredAdminPermissions("/api/v1/admin/account/password", "POST"), null);
  assert.notEqual(requiredAdminPermissions("/api/v1/admin/users/account", "POST"), null);
  assert.notEqual(requiredAdminPermissions("/api/v1/admin/posts/session", "POST"), null);
});

function roleCan(code: string, pathname: string, method: string) {
  const role = defaultCmsRoles.find((item) => item.code === code);
  assert.ok(role, code);
  const required = requiredAdminPermissions(pathname, method);
  return required === null || actorMayAccess({ role: code, permissions: role.permissions }, required);
}

test("Role mặc định: danh mục hợp lệ, Super Admin đủ quyền", () => {
  for (const role of defaultCmsRoles) for (const code of role.permissions) assert.ok(isCmsPermissionCode(code), `${role.code}: ${code}`);
  assert.equal(defaultCmsRoles.find((role) => role.code === "admin")?.permissions.length, cmsPermissions.length);
  assert.equal(new Set(cmsPermissions.map((permission) => permission.code)).size, cmsPermissions.length);
});

test("Ma trận role mặc định × thao tác tiêu biểu", () => {
  const cases: Array<[string, string, string, boolean]> = [
    ["content_manager", "/api/v1/admin/users", "POST", false],
    ["content_manager", "/api/v1/admin/redirects", "POST", true],
    ["editor", "/api/v1/admin/posts", "POST", true],
    ["editor", "/api/v1/admin/redirects", "POST", false],
    ["editor", "/api/v1/admin/navigation", "PUT", false],
    ["editor", "/api/v1/admin/leads", "GET", false],
    ["publisher", "/api/v1/admin/posts/0b5c", "PATCH", true],
    ["publisher", "/api/v1/admin/posts", "POST", false],
    ["marketing", "/api/v1/admin/navigation", "PUT", true],
    ["marketing", "/api/v1/admin/taxonomy", "POST", false],
    ["marketing", "/api/v1/admin/taxonomy", "GET", true],
    ["support", "/api/v1/admin/taxonomy", "GET", false],
    ["support", "/api/v1/admin/leads/0b5c", "PATCH", true],
    ["support", "/api/v1/admin/posts", "GET", false],
    ["analyst", "/api/v1/admin/audit", "GET", true],
    ["analyst", "/api/v1/admin/users", "GET", false],
  ];
  for (const [role, pathname, method, allowed] of cases) {
    assert.equal(roleCan(role, pathname, method), allowed, `${role} ${method} ${pathname}`);
  }
});

test("Role phân tích chỉ đọc: không qua được mutation nào", () => {
  for (const [pathname, method] of routeTable) {
    if (method === "GET" || pathname.endsWith("/session")) continue;
    assert.equal(roleCan("analyst", pathname, method), false, `${method} ${pathname}`);
  }
});

test("Editor không có publish; nội dung đang công khai cần publish", () => {
  const editor = defaultCmsRoles.find((role) => role.code === "editor")!;
  assert.equal(editor.permissions.some((code) => code.endsWith(".publish")), false);
  assert.equal(needsPublishPermission({ requestedStatus: "draft", currentStatus: "draft" }), false);
  assert.equal(needsPublishPermission({ requestedStatus: "review", currentStatus: null }), false);
  assert.equal(needsPublishPermission({ requestedStatus: "published" }), true);
  assert.equal(needsPublishPermission({ requestedStatus: "scheduled" }), true);
  assert.equal(needsPublishPermission({ requestedStatus: "draft", currentStatus: "published" }), true);
  assert.equal(needsPublishPermission({ stateAction: "archive" }), true);
});

test("Không cấp được quyền mình không có; Super Admin thì được", () => {
  const access = (isSuperAdmin: boolean, permissions: string[]): ActorAccess => ({ superRoleId: "s", isSuperAdmin, roleIds: new Set(), permissions: new Set(permissions) });
  assert.doesNotThrow(() => assertCanGrant(access(false, ["posts.view", "posts.update"]), ["posts.view"]));
  assert.throws(() => assertCanGrant(access(false, ["posts.view"]), ["posts.publish"]), CmsAccessError);
  assert.doesNotThrow(() => assertCanGrant(access(true, []), ["roles.delete"]));
});
