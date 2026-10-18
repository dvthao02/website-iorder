import assert from "node:assert/strict";
import test from "node:test";

import { cmsPermissions, defaultCmsRoles, isCmsPermissionCode, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { assertCanGrant, type ActorAccess } from "@iorder/core/server/roles/roles.repository";
import { CmsAccessError } from "@iorder/core/server/roles/roles.errors";

import { needsPublishPermission } from "./admin-access";
import { actorMayAccess, requiredAdminPermissions } from "./admin-permission";

// One row per admin route and method under apps/backend/src/app/api/admin.
const routeTable: Array<[string, string, CmsPermissionCode[] | null]> = [
  ["/api/admin/session", "POST", null],
  ["/api/admin/session", "DELETE", null],
  ["/api/admin/dashboard", "GET", cmsPermissions.map((permission) => permission.code).filter((code) => code.endsWith(".view"))],
  ["/api/admin/tim-kiem", "GET", cmsPermissions.map((permission) => permission.code).filter((code) => code.endsWith(".view"))],
  ["/api/admin/notifications", "GET", cmsPermissions.map((permission) => permission.code).filter((code) => code.endsWith(".view"))],
  ["/api/admin/notifications", "POST", []],
  ["/api/admin/audit", "GET", ["audit.view"]],
  ["/api/admin/users", "GET", ["users.view"]],
  ["/api/admin/users", "POST", ["users.create", "users.update"]],
  ["/api/admin/roles", "GET", ["roles.view"]],
  ["/api/admin/roles", "POST", ["roles.create", "roles.update"]],
  ["/api/admin/roles", "DELETE", ["roles.delete"]],
  ["/api/admin/leads", "GET", ["leads.view"]],
  ["/api/admin/leads/0b5c", "PATCH", ["leads.update"]],
  ["/api/admin/media", "GET", ["media.view"]],
  ["/api/admin/media", "POST", ["media.create"]],
  ["/api/admin/media/0b5c", "PATCH", ["media.update"]],
  ["/api/admin/media/0b5c", "DELETE", ["media.delete"]],
  ["/api/admin/media/0b5c/usage", "GET", ["media.view"]],
  ["/api/admin/taxonomy", "POST", ["taxonomy.create", "taxonomy.update"]],
  ["/api/admin/taxonomy", "DELETE", ["taxonomy.delete"]],
  ["/api/admin/navigation", "PUT", ["navigation.update"]],
  ["/api/admin/navigation/targets", "GET", ["navigation.view"]],
  ["/api/admin/redirects", "POST", ["redirects.create", "redirects.update"]],
  ["/api/admin/redirects", "DELETE", ["redirects.delete"]],
  ["/api/admin/publishing-config", "PUT", ["settings.update"]],
  ["/api/admin/external-links", "PUT", ["settings.update"]],
  ["/api/admin/profile", "GET", ["settings.view"]],
  // API cũ đã gỡ: chỉ Super Admin qua được proxy (rồi route trả 404).
  ["/api/admin/catalog-content", "PUT", []],
  ["/api/admin/posts", "GET", ["posts.view"]],
  ["/api/admin/posts", "POST", ["posts.create"]],
  ["/api/admin/posts/0b5c", "PATCH", ["posts.update"]],
  ["/api/admin/posts/0b5c", "DELETE", ["posts.delete"]],
  ["/api/admin/offerings", "POST", ["offerings.create"]],
  ["/api/admin/offerings/0b5c", "DELETE", ["offerings.delete"]],
  ["/api/admin/pages", "GET", ["pages.view", "posts.view", "equipment.view", "support_downloads.view", "offerings.view"]],
  ["/api/admin/pages/0b5c", "GET", ["pages.view", "posts.view", "equipment.view", "support_downloads.view", "offerings.view"]],
  ["/api/admin/pages", "POST", ["pages.create", "pages.update", "posts.update", "equipment.update", "support_downloads.update", "offerings.update"]],
  ["/api/admin/pages/0b5c", "DELETE", ["pages.delete"]],
  ["/api/admin/equipment", "POST", ["equipment.create", "equipment.update"]],
  ["/api/admin/equipment/0b5c", "PATCH", ["equipment.update"]],
  ["/api/admin/support-downloads", "POST", ["support_downloads.create"]],
  ["/api/admin/support-downloads/0b5c", "PATCH", ["support_downloads.update"]],
  ["/api/admin/supporting", "POST", ["supporting.create", "supporting.update"]],
  ["/api/admin/supporting", "DELETE", ["supporting.delete"]],
  ["/api/admin/revisions/posts/0b5c", "GET", ["posts.view"]],
  ["/api/admin/revisions/downloads/0b5c", "POST", ["support_downloads.update"]],
  ["/api/admin/revisions/navigation/0b5c", "POST", ["navigation.update"]],
];

test("Mỗi route admin ánh xạ đúng permission", () => {
  for (const [pathname, method, expected] of routeTable) {
    assert.deepEqual(requiredAdminPermissions(pathname, method), expected, `${method} ${pathname}`);
  }
});

test("Route con, dấu / cuối và method chữ thường không làm lỏng quyền", () => {
  assert.deepEqual(requiredAdminPermissions("/api/admin/users/", "GET"), ["users.view"]);
  assert.deepEqual(requiredAdminPermissions("/api/admin/users/0b5c", "PATCH"), ["users.update"]);
  assert.deepEqual(requiredAdminPermissions("/api/admin/posts", "patch"), ["posts.update"]);
});

test("Resource lạ, hành động module không có hoặc revision lạ chỉ Super Admin qua được", () => {
  for (const [pathname, method] of [["/api/admin/khong-ton-tai", "GET"], ["/api/admin/navigation", "DELETE"], ["/api/admin/audit", "DELETE"], ["/api/admin/revisions/la/0b5c", "GET"], ["/api/admin/posts", "OPTIONS"]]) {
    const required = requiredAdminPermissions(pathname, method);
    assert.deepEqual(required, [], `${method} ${pathname}`);
    assert.equal(actorMayAccess({ role: "admin", permissions: [] }, required!), true);
    assert.equal(actorMayAccess({ role: "editor", permissions: cmsPermissions.map((permission) => permission.code) }, required!), false);
  }
});

test("Chỉ endpoint session và account (tự kiểm tra đăng nhập) được bỏ qua kiểm tra quyền", () => {
  assert.equal(requiredAdminPermissions("/api/admin/session", "POST"), null);
  assert.equal(requiredAdminPermissions("/api/admin/account/password", "POST"), null);
  assert.notEqual(requiredAdminPermissions("/api/admin/users/account", "POST"), null);
  assert.notEqual(requiredAdminPermissions("/api/admin/posts/session", "POST"), null);
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
    ["content_manager", "/api/admin/users", "POST", false],
    ["content_manager", "/api/admin/redirects", "POST", true],
    ["editor", "/api/admin/posts", "POST", true],
    ["editor", "/api/admin/redirects", "POST", false],
    ["editor", "/api/admin/navigation", "PUT", false],
    ["editor", "/api/admin/leads", "GET", false],
    ["publisher", "/api/admin/posts/0b5c", "PATCH", true],
    ["publisher", "/api/admin/posts", "POST", false],
    ["marketing", "/api/admin/navigation", "PUT", true],
    ["marketing", "/api/admin/taxonomy", "POST", false],
    ["support", "/api/admin/leads/0b5c", "PATCH", true],
    ["support", "/api/admin/posts", "GET", false],
    ["analyst", "/api/admin/audit", "GET", true],
    ["analyst", "/api/admin/users", "GET", false],
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
