import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// Test chạy từ thư mục gốc của repo (pnpm test). Đọc nguồn thay vì dựng khung CMS vì khung cần ngữ cảnh trình duyệt.
const shell = readFileSync(path.join(process.cwd(), "apps/admin/src/components/admin/admin-shell.tsx"), "utf8");

const groupBlock = (id: string, nextId: string) => {
  const start = shell.indexOf(`id: "${id}"`);
  const end = shell.indexOf(`id: "${nextId}"`, start);
  assert.ok(start >= 0 && end > start, `không tìm thấy nhóm ${id}`);
  return shell.slice(start, end);
};
// Chỉ lấy mục cấp trên cùng (thụt 6 khoảng trắng), không lấy subPages/fallback lồng trong cùng dòng.
const hrefsOf = (block: string) => [...block.matchAll(/^ {6}\{ href: "(\/admin[^"]*)", label: "/gm)].map((match) => match[1]);

test("Menu: Sản phẩm, Thiết bị, Tệp cài đặt, Đối tác nằm chung nhóm Nội dung website; không còn nhóm Sản phẩm & tài nguyên riêng", () => {
  assert.ok(!shell.includes('id: "catalog"') && !shell.includes("Sản phẩm & tài nguyên"), "nhóm catalog đã được gộp");
  const content = groupBlock("content", "structure");
  assert.match(content, /label: "Nội dung website"/);
  assert.deepEqual(hrefsOf(content), [
    "/admin/homepage", "/admin/pages", "/admin/news", "/admin/guides",
    "/admin/products", "/admin/equipment", "/admin/resources", "/admin/partners",
    "/admin/media",
  ]);
});

test("Menu: các mục đã gộp giữ nguyên quyền xem và đường dẫn con (Giải pháp, Dịch vụ thuộc Sản phẩm & Dịch vụ)", () => {
  const content = groupBlock("content", "structure");
  assert.match(content, /href: "\/admin\/products", label: "Sản phẩm & Dịch vụ", icon: Package, matchesChildRoutes: true, permission: "offerings\.view", subPages: \[\{ href: "\/admin\/solutions" \}, \{ href: "\/admin\/services" \}\]/);
  assert.match(content, /href: "\/admin\/equipment", label: "Thiết bị", icon: Laptop, matchesChildRoutes: true, permission: "equipment\.view"/);
  assert.match(content, /href: "\/admin\/resources", label: "Tệp cài đặt", icon: Download, matchesChildRoutes: true, permission: "support_downloads\.view"/);
  assert.match(content, /href: "\/admin\/partners", label: "Đối tác & Đánh giá", icon: Star, permission: "supporting\.view"/);
});

test("Menu: thứ tự các nhóm là Công việc, Nội dung website, Cấu trúc website, Hệ thống", () => {
  const order = [...shell.matchAll(/(?:\{ id|\bid): "(work|content|structure|system|catalog)"/g)].map((match) => match[1]);
  assert.deepEqual(order, ["work", "content", "structure", "system"]);
});
