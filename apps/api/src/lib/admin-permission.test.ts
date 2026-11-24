import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
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
  // Đọc/xóa thông báo là trạng thái riêng của từng người: cùng điều kiện với xem thông báo. Các phương thức khác chỉ Super Admin.
  ["/api/v1/admin/notifications", "POST", cmsPermissions.map((permission) => permission.code).filter((code) => code.endsWith(".view"))],
  ["/api/v1/admin/notifications", "PATCH", []],
  ["/api/v1/admin/notifications", "DELETE", []],
  ["/api/v1/admin/audit", "GET", ["audit.view"]],
  ["/api/v1/admin/users", "GET", ["users.view"]],
  ["/api/v1/admin/users", "POST", ["users.create", "users.update"]],
  ["/api/v1/admin/users", "DELETE", ["users.delete"]],
  ["/api/v1/admin/roles", "GET", ["roles.view"]],
  ["/api/v1/admin/roles", "POST", ["roles.create", "roles.update"]],
  ["/api/v1/admin/roles", "DELETE", ["roles.delete"]],
  ["/api/v1/admin/leads", "GET", ["leads.view"]],
  ["/api/v1/admin/leads/0b5c", "GET", ["leads.view"]],
  ["/api/v1/admin/leads/0b5c", "PATCH", ["leads.update"]],
  // Xóa liên hệ rác và gộp liên hệ trùng (thực chất là xóa các liên hệ cũ) cùng quyền leads.delete; không có đường nào khác để gộp.
  ["/api/v1/admin/leads/0b5c", "DELETE", ["leads.delete"]],
  ["/api/v1/admin/leads/merge", "POST", ["leads.delete"]],
  ["/api/v1/admin/leads/merge", "PATCH", []],
  ["/api/v1/admin/leads/merge", "DELETE", []],
  ["/api/v1/admin/media", "GET", ["media.view"]],
  ["/api/v1/admin/media", "POST", ["media.create"]],
  // Tự tải tệp từ link vào thư viện: cùng quyền với tải tệp lên (media.create), không mở thêm đường vào.
  ["/api/v1/admin/media/import-url", "POST", ["media.create"]],
  ["/api/v1/admin/media/import-url", "GET", ["media.view"]],
  ["/api/v1/admin/media/0b5c", "PATCH", ["media.update"]],
  ["/api/v1/admin/media/0b5c", "DELETE", ["media.delete"]],
  ["/api/v1/admin/media/0b5c/usage", "GET", ["media.view"]],
  ["/api/v1/admin/taxonomy", "GET", ["taxonomy.view", "posts.view"]],
  ["/api/v1/admin/taxonomy", "POST", ["taxonomy.create", "taxonomy.update"]],
  ["/api/v1/admin/taxonomy", "DELETE", ["taxonomy.delete"]],
  // Tác giả bài viết dùng quyền của mô-đun Bài viết.
  ["/api/v1/admin/search-console", "GET", ["settings.view"]],
  // Không có thao tác ghi: mọi phương thức khác chỉ Super Admin (và route cũng không định nghĩa).
  ["/api/v1/admin/search-console", "POST", []],
  ["/api/v1/admin/search-console", "DELETE", []],
  ["/api/v1/admin/authors", "GET", ["posts.view"]],
  ["/api/v1/admin/authors", "POST", ["posts.create", "posts.update"]],
  ["/api/v1/admin/authors", "DELETE", ["posts.delete"]],
  ["/api/v1/admin/navigation", "PUT", ["navigation.update"]],
  ["/api/v1/admin/navigation/targets", "GET", ["navigation.view"]],
  ["/api/v1/admin/redirects", "POST", ["redirects.create", "redirects.update"]],
  ["/api/v1/admin/redirects", "DELETE", ["redirects.delete"]],
  ["/api/v1/admin/publishing-config", "PUT", ["settings.update"]],
  ["/api/v1/admin/external-links", "PUT", ["settings.update"]],
  ["/api/v1/admin/consult-form", "GET", ["settings.view"]],
  ["/api/v1/admin/consult-form", "PUT", ["settings.update"]],
  ["/api/v1/admin/promotion-popup", "GET", ["settings.view"]],
  ["/api/v1/admin/promotion-popup", "PUT", ["settings.update"]],
  ["/api/v1/admin/profile", "GET", ["settings.view"]],
  ["/api/v1/admin/seo-audit", "GET", ["settings.view"]],
  ["/api/v1/admin/backup", "GET", ["system.view"]],
  ["/api/v1/admin/backup", "POST", []],
  // Dọn nhật ký: module audit chỉ có view nên POST chỉ Super Admin.
  ["/api/v1/admin/audit", "GET", ["audit.view"]],
  ["/api/v1/admin/audit", "POST", []],
  // Tải bản sao lưu: proxy chỉ đòi system.view như mọi GET của module; route tự đòi thêm Super Admin (xem test bên dưới).
  ["/api/v1/admin/backup/download", "GET", ["system.view"]],
  // Tình trạng hệ thống: quyền riêng system.view, chỉ đọc (mọi method khác chỉ Super Admin).
  ["/api/v1/admin/system-status", "GET", ["system.view"]],
  ["/api/v1/admin/system-status", "POST", []],
  ["/api/v1/admin/system-status", "DELETE", []],
  // Kết nối & khóa API: không map permission nào, chỉ Super Admin (mọi method).
  ["/api/v1/admin/secrets", "GET", []],
  ["/api/v1/admin/secrets", "POST", []],
  ["/api/v1/admin/secrets", "PUT", []],
  ["/api/v1/admin/secrets", "DELETE", []],
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
  // Hồ sơ và ảnh đại diện: người nào cũng tự sửa của mình, không cần quyền Người dùng CMS hay Thư viện media.
  assert.equal(requiredAdminPermissions("/api/v1/admin/account/profile", "PATCH"), null);
  assert.equal(requiredAdminPermissions("/api/v1/admin/account/avatar", "POST"), null);
  assert.equal(requiredAdminPermissions("/api/v1/admin/account/avatar", "DELETE"), null);
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
    ["support", "/api/v1/admin/leads/0b5c", "DELETE", true],
    ["support", "/api/v1/admin/leads/merge", "POST", true],
    ["editor", "/api/v1/admin/leads/merge", "POST", false],
    ["editor", "/api/v1/admin/leads/0b5c", "DELETE", false],
    ["analyst", "/api/v1/admin/leads/0b5c", "DELETE", false],
    ["analyst", "/api/v1/admin/leads/merge", "POST", false],
    ["support", "/api/v1/admin/posts", "GET", false],
    ["analyst", "/api/v1/admin/audit", "GET", true],
    ["analyst", "/api/v1/admin/users", "GET", false],
    // Vận hành hệ thống: theo dõi (tình trạng, nhật ký, sao lưu xem lịch sử) nhưng không sửa gì.
    ["sysops", "/api/v1/admin/system-status", "GET", true],
    ["sysops", "/api/v1/admin/audit", "GET", true],
    ["sysops", "/api/v1/admin/backup", "GET", true],
    ["sysops", "/api/v1/admin/backup", "POST", false],
    ["sysops", "/api/v1/admin/audit", "GET", true],
    ["sysops", "/api/v1/admin/audit", "POST", false],
    // Sao lưu là thông tin hạ tầng: vai trò nội dung/cấu hình/phân tích không còn thấy, dù có settings.view.
    ["content_manager", "/api/v1/admin/backup", "GET", false],
    ["marketing", "/api/v1/admin/backup", "GET", false],
    ["analyst", "/api/v1/admin/backup", "GET", false],
    ["sysops", "/api/v1/admin/dashboard", "GET", true],
    ["sysops", "/api/v1/admin/publishing-config", "PUT", false],
    ["sysops", "/api/v1/admin/posts", "GET", false],
    ["sysops", "/api/v1/admin/posts", "POST", false],
    ["sysops", "/api/v1/admin/leads", "GET", false],
    ["sysops", "/api/v1/admin/users", "GET", false],
    ["sysops", "/api/v1/admin/roles", "GET", false],
    ["sysops", "/api/v1/admin/media", "GET", false],
    // Tình trạng hệ thống là thông tin hạ tầng: chỉ Super Admin và vai trò Vận hành mặc định thấy.
    ["analyst", "/api/v1/admin/system-status", "GET", false],
    ["content_manager", "/api/v1/admin/system-status", "GET", false],
    ["marketing", "/api/v1/admin/system-status", "GET", false],
    ["editor", "/api/v1/admin/system-status", "GET", false],
    ["publisher", "/api/v1/admin/system-status", "GET", false],
    ["support", "/api/v1/admin/system-status", "GET", false],
  ];
  for (const [role, pathname, method, allowed] of cases) {
    assert.equal(roleCan(role, pathname, method), allowed, `${role} ${method} ${pathname}`);
  }
});

test("Khóa API ở CMS chỉ Super Admin: không vai trò mặc định nào (kể cả Vận hành, Nội dung) gọi được, mọi method; route tự kiểm lại Super Admin và không trả giá trị", () => {
  for (const role of defaultCmsRoles.filter((item) => item.code !== "admin")) {
    for (const method of ["GET", "PUT", "DELETE", "POST"]) assert.equal(roleCan(role.code, "/api/v1/admin/secrets", method), false, `${role.code} ${method}`);
  }
  assert.equal(requiredAdminPermissions("/api/v1/admin/secrets/", "put")?.length, 0, "dấu / cuối và method chữ thường không làm lỏng quyền");
  const route = readFileSync(path.join(process.cwd(), "apps/api/src/app/api/v1/admin/secrets/route.ts"), "utf8");
  assert.match(route, /isSuperAdmin\(user\)/, "route tự kiểm Super Admin");
  assert.match(route, /"cache-control": "no-store"/);
  assert.ok(/createMasterKeyRequestSchema\.parse/.test(route) && (route.match(/export const (POST|PUT|DELETE)/g) ?? []).length === 3, "POST chỉ để tạo khóa chủ (kèm mật khẩu), cùng PUT và DELETE; không có method nào khác");
  // Giá trị khóa người dùng gửi lên không được đưa lại vào phản hồi hay log.
  assert.ok(!/NextResponse\.json\(\{[^}]*\bvalue\b/.test(route) && !/logger\.[a-z]+\([^)]*\bbody\b/.test(route), "phản hồi và log không chứa body.value");
});

test("Tải bản sao lưu chứa cả dữ liệu nhạy cảm: route tự kiểm Super Admin (vai trò Vận hành qua được proxy nhưng không qua được route) và không cache", () => {
  const route = readFileSync(path.join(process.cwd(), "apps/api/src/app/api/v1/admin/backup/download/route.ts"), "utf8");
  assert.ok(route.includes("isSuperAdmin(administrator)"));
  assert.ok(route.indexOf("isSuperAdmin(administrator)") < route.indexOf("prepareBackupDownload("), "kiểm quyền trước khi đóng gói");
  assert.match(route, /"cache-control": "no-store"/);
  assert.equal((route.match(/export const (GET|POST|PUT|DELETE|PATCH)\b/g) ?? []).length, 1, "chỉ có GET");
});

test("Vai trò Vận hành hệ thống: chỉ quyền xem (không có create/update/delete/publish), đúng ba mô-đun cần để theo dõi (bảng điều khiển, nhật ký, tình trạng hệ thống)", () => {
  const sysops = defaultCmsRoles.find((role) => role.code === "sysops")!;
  assert.ok(sysops, "có vai trò mặc định sysops");
  assert.equal(sysops.name, "Vận hành hệ thống");
  assert.deepEqual([...sysops.permissions].sort(), ["audit.view", "dashboard.view", "system.view"]);
  assert.ok(sysops.permissions.every((code) => code.endsWith(".view")));
  // Chỉ Super Admin và sysops có system.view mặc định; không vai trò nội dung nào vô tình thấy thông tin hạ tầng.
  assert.deepEqual(defaultCmsRoles.filter((role) => role.permissions.includes("system.view")).map((role) => role.code).sort(), ["admin", "sysops"]);
  for (const [pathname, method] of routeTable) {
    // Đọc/xóa thông báo của chính mình không phải thao tác sửa nội dung: vai trò chỉ xem vẫn dùng được.
    if (method === "GET" || pathname.endsWith("/session") || (pathname.endsWith("/notifications") && method === "POST")) continue;
    assert.equal(roleCan("sysops", pathname, method), false, `${method} ${pathname}`);
  }
  assert.equal(roleCan("sysops", "/api/v1/admin/notifications", "POST"), true);
});

test("Role phân tích chỉ đọc: không qua được mutation nào", () => {
  for (const [pathname, method] of routeTable) {
    if (method === "GET" || pathname.endsWith("/session") || (pathname.endsWith("/notifications") && method === "POST")) continue;
    assert.equal(roleCan("analyst", pathname, method), false, `${method} ${pathname}`);
  }
  assert.equal(roleCan("analyst", "/api/v1/admin/notifications", "POST"), true);
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
