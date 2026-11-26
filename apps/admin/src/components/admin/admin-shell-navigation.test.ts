import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { cmsPermissions, defaultCmsRoles } from "@iorder/shared/server/auth/permissions";

import { canOpenAdminPath, isActive, navigationGroups, visibleNavigationItems } from "./admin-navigation";

// Test chạy từ thư mục gốc của repo (pnpm test).
const labelsOf = (groupId: string) => navigationGroups.find((group) => group.id === groupId)!.items.map((item) => item.label);
const hrefsOf = (groupId: string) => navigationGroups.find((group) => group.id === groupId)!.items.map((item) => item.href);
const allItems = navigationGroups.flatMap((group) => group.items);
const actorOf = (code: string) => {
  const role = defaultCmsRoles.find((item) => item.code === code);
  assert.ok(role, code);
  return { role: code, permissions: role.permissions as readonly string[] };
};
const visibleLabels = (code: string) => navigationGroups.flatMap((group) => visibleNavigationItems(actorOf(code), group.items)).map((item) => item.label);

test("Menu: thứ tự các nhóm là Công việc, Nội dung website, Cấu trúc website, Cài đặt website, Hệ thống", () => {
  assert.deepEqual(navigationGroups.map((group) => group.id), ["work", "content", "structure", "settings", "system"]);
  assert.deepEqual(navigationGroups.map((group) => group.label), ["Công việc", "Nội dung website", "Cấu trúc website", "Cài đặt website", "Hệ thống"]);
});

test("Menu: Sản phẩm, Thiết bị, Tệp cài đặt, Đối tác nằm chung nhóm Nội dung website; không còn nhóm Sản phẩm & tài nguyên riêng", () => {
  assert.ok(!navigationGroups.some((group) => group.id === "catalog" || group.label === "Sản phẩm & tài nguyên"), "nhóm catalog đã được gộp");
  assert.deepEqual(hrefsOf("content"), [
    "/admin/homepage", "/admin/pages", "/admin/news", "/admin/guides",
    "/admin/products", "/admin/equipment", "/admin/resources", "/admin/partners",
    "/admin/media",
  ]);
  const byHref = (href: string) => allItems.find((item) => item.href === href)!;
  assert.equal(byHref("/admin/products").permission, "offerings.view");
  assert.deepEqual(byHref("/admin/products").subPages, [{ href: "/admin/solutions" }]);
  assert.equal(byHref("/admin/equipment").permission, "equipment.view");
  assert.equal(byHref("/admin/resources").permission, "support_downloads.view");
  assert.equal(byHref("/admin/partners").permission, "supporting.view");
});

test("Menu: theo dõi hiệu quả nằm chung Công việc; cấu trúc tách khỏi cài đặt; Hệ thống đi từ vận hành tới truy cập rồi khóa kết nối", () => {
  assert.deepEqual(labelsOf("work"), ["Bảng điều khiển", "Khách hàng tiềm năng", "Thống kê truy cập", "Google Search Console", "Kiểm tra trước xuất bản"]);
  assert.deepEqual(labelsOf("structure"), ["Menu & Điều hướng", "Chuyển hướng URL", "Biểu mẫu tư vấn", "Quảng cáo"]);
  assert.deepEqual(labelsOf("settings"), ["Thông tin doanh nghiệp", "Tên miền & SEO", "Liên kết & Mạng xã hội", "Đa ngôn ngữ"]);
  assert.deepEqual(labelsOf("system"), ["Tình trạng hệ thống", "Sao lưu & phục hồi", "Người dùng & vai trò", "Nhật ký hoạt động", "Kết nối & khóa API", "Gmail báo liên hệ"]);
});

test("Menu: đường dẫn không trùng, mỗi mục có trang, mọi quyền khai báo đều có thật", () => {
  const hrefs = allItems.map((item) => item.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "đường dẫn trùng");
  const known = new Set<string>(cmsPermissions.map((permission) => permission.code));
  for (const item of allItems) {
    const folder = item.href === "/admin" ? "" : `${item.href.replace("/admin/", "")}/`;
    assert.ok(existsSync(path.join(process.cwd(), `apps/admin/src/app/admin/(protected)/${folder}page.tsx`)), `không có trang cho ${item.href}`);
    for (const code of [].concat((item.permission ?? []) as never)) assert.ok(known.has(code), `${item.label}: quyền ${code} không tồn tại`);
    if (item.fallback) assert.ok(known.has(item.fallback.permission), `${item.label}: quyền dự phòng không tồn tại`);
  }
});

// Quyền hiện trên thanh bên phải bằng quyền mà trang thực sự đòi: lệch nhau thì hoặc thấy mục mà bấm vào bị chặn, hoặc có quyền mà không thấy mục.
test("Menu: quyền của từng mục khớp với quyền trang đó kiểm", () => {
  for (const item of allItems) {
    if (item.href === "/admin") continue;
    const source = readFileSync(path.join(process.cwd(), `apps/admin/src/app/admin/(protected)/${item.href.replace("/admin/", "")}/page.tsx`), "utf8");
    const required = [...source.matchAll(/requireAdminPermission\(([^)]*)\)/g)].flatMap((match) => match[1].replace(/["'\[\]\s]/g, "").split(","));
    if (/requireSuperAdmin\(/.test(source)) required.push("SUPER_ADMIN");
    for (const match of source.matchAll(/hasCmsPermission\(actor, "([a-z_.]+)"\)/g)) required.push(match[1]);
    const declared = item.superAdminOnly ? ["SUPER_ADMIN"] : [].concat((item.permission ?? []) as never);
    assert.deepEqual([...new Set(required)].sort(), declared.sort(), `${item.label} (${item.href})`);
  }
});

test("Vai trò Vận hành hệ thống chỉ thấy phần theo dõi, không thấy trang cài đặt nội dung", () => {
  assert.deepEqual(visibleLabels("sysops"), ["Bảng điều khiển", "Thống kê truy cập", "Tình trạng hệ thống", "Sao lưu & phục hồi", "Nhật ký hoạt động"]);
});

test("Sao lưu là thông tin hạ tầng: vai trò nội dung, marketing và phân tích không thấy; Super Admin thấy cả Kết nối & khóa API", () => {
  for (const code of ["content_manager", "editor", "publisher", "marketing", "support", "analyst"]) {
    assert.ok(!visibleLabels(code).includes("Sao lưu & phục hồi"), `${code} không được thấy Sao lưu`);
    assert.ok(!visibleLabels(code).includes("Tình trạng hệ thống"), `${code} không được thấy Tình trạng hệ thống`);
    assert.ok(!visibleLabels(code).includes("Kết nối & khóa API"), `${code} không được thấy Kết nối & khóa API`);
  }
  assert.ok(visibleLabels("admin").includes("Kết nối & khóa API"));
  assert.ok(visibleLabels("admin").includes("Sao lưu & phục hồi"));
});

test("Người chỉ có một quyền nhỏ không thấy nhóm rỗng", () => {
  const onlyLeads = { role: "custom", permissions: ["leads.view"] };
  const groups = navigationGroups.map((group) => ({ id: group.id, items: visibleNavigationItems(onlyLeads, group.items).map((item) => item.label) })).filter((group) => group.items.length);
  assert.deepEqual(groups, [{ id: "work", items: ["Bảng điều khiển", "Khách hàng tiềm năng"] }]);
});

test("canOpenAdminPath: theo đúng quyền hiển thị mục, bỏ qua query và hash, đường dẫn lạ thì không ẩn", () => {
  const sysops = actorOf("sysops");
  assert.equal(canOpenAdminPath(sysops, "/admin/backup"), true);
  assert.equal(canOpenAdminPath(sysops, "/admin/system?x=1#y"), true);
  assert.equal(canOpenAdminPath(sysops, "/admin/search-console"), false);
  assert.equal(canOpenAdminPath(sysops, "/admin/integrations"), false);
  assert.equal(canOpenAdminPath(actorOf("admin"), "/admin/integrations"), true);
  assert.equal(canOpenAdminPath(actorOf("marketing"), "/admin/seo"), true);
  assert.equal(canOpenAdminPath(actorOf("marketing"), "/admin/backup"), false);
  assert.equal(canOpenAdminPath(sysops, "/admin/trang-chua-co"), true);
  // Chuyên mục & Thẻ: mở được bằng quyền taxonomy.view dù không có posts.view (mục dự phòng của Bài viết).
  assert.equal(canOpenAdminPath({ role: "custom", permissions: ["taxonomy.view"] }, "/admin/taxonomy"), true);
  assert.equal(canOpenAdminPath({ role: "custom", permissions: ["leads.view"] }, "/admin/taxonomy"), false);
});

test("Mục đang chọn tính cả trang con và subPages", () => {
  const news = allItems.find((item) => item.href === "/admin/news")!;
  assert.equal(isActive("/admin/news", news), true);
  assert.equal(isActive("/admin/news/0b5c", news), true);
  assert.equal(isActive("/admin/taxonomy", news), true);
  assert.equal(isActive("/admin/guides", news), false);
  const backup = allItems.find((item) => item.href === "/admin/backup")!;
  assert.equal(isActive("/admin/backup/lich-su", backup), false, "mục không khai matchesChildRoutes thì chỉ khớp đúng đường dẫn");
});
