import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { SystemStatus } from "@iorder/shared/server/system/system-status.contract";
import { formatBytes, formatUptime, problemsOf, relativeTime, SystemStatusView } from "./system-status-panel";
import { AdminPermissionsProvider } from "./ui/admin-permissions";
import { navigationGroups } from "./admin-navigation";

// AdminCard/AdminNotice dùng JSX kiểu cũ (không tự import React) nên test cần React toàn cục.
(globalThis as { React?: typeof React }).React = React;

const now = new Date("2026-11-19T10:00:00Z");
const ok = (summary: string) => ({ state: "ok" as const, summary });

const healthy: SystemStatus = {
  checkedAt: "2026-11-19T10:00:00.000Z",
  overall: "ok",
  counts: { ok: 12, warn: 0, error: 0, unknown: 2 },
  app: { commit: "a1b2c3d", environment: "production", service: "api" },
  services: {
    database: { ...ok("Kết nối tốt, phản hồi 4 ms."), latencyMs: 4, version: "PostgreSQL 17.2", sizeBytes: 123_456_789, connections: { used: 5, max: 100 } },
    migrations: { ...ok("Đã áp dụng đủ 25/25 migration."), applied: 25, expected: 25, lastAppliedAt: "2026-11-19T01:00:00.000Z" },
    storage: ok("Kho tệp (S3) hoạt động, phản hồi 12 ms."),
    website: ok("Website phản hồi tốt (30 ms)."),
    analytics: { state: "unknown", summary: "Chưa nối Umami (không bắt buộc)." },
    searchConsole: { state: "unknown", summary: "Chưa nối Google Search Console (không bắt buộc)." },
  },
  server: { ...ok("Tài nguyên máy chủ ổn: ổ đĩa còn 60% trống, RAM còn 50% khả dụng."), uptimeSeconds: 3 * 86_400 + 2 * 3_600, nodeVersion: "v24.0.0", platform: "linux", cpuCount: 4, loadAverage: [0.5, 0.4, 0.3], memory: { totalBytes: 8_000_000_000, freeBytes: 4_000_000_000, processBytes: 300_000_000 }, disk: { totalBytes: 100_000_000_000, freeBytes: 60_000_000_000 } },
  backup: { ...ok("Có bản sao lưu gần đây và đã khôi phục thử."), lastSuccessAt: "2026-11-19T02:30:00.000Z" },
  jobs: [
    { name: "login-throttles", label: "Dọn bucket đăng nhập hết hạn", schedule: "Hằng ngày", state: "ok", summary: "Đã dọn 3 bucket.", lastRunAt: "2026-11-19T05:00:00.000Z" },
    { name: "media-cleanup", label: "Dọn media đã xóa", schedule: "Thủ công", state: "unknown", summary: "Chưa ghi nhận lần chạy nào." },
    { name: "content-cleanup", label: "Dọn thùng rác nội dung", schedule: "Thủ công", state: "unknown", summary: "Chưa ghi nhận lần chạy nào." },
  ],
  config: [
    { key: "revalidate-secret", label: "Khóa làm mới website (PUBLISH_WEB_REVALIDATE_SECRET)", ok: true, required: true },
    { key: "analytics", label: "Thống kê truy cập (Umami)", ok: false, required: false },
  ],
};

const troubled: SystemStatus = {
  ...healthy,
  overall: "error",
  counts: { ok: 8, warn: 2, error: 1, unknown: 2 },
  services: {
    ...healthy.services,
    database: { state: "error", summary: "Không kết nối được database. Nội dung và đăng nhập sẽ lỗi." },
    migrations: { state: "warn", summary: "Còn 2 migration chưa áp dụng (23/25). Chạy lại dịch vụ migrate.", applied: 23, expected: 25 },
  },
  backup: { state: "warn", summary: "Hơn 36 giờ chưa có bản sao lưu mới: kiểm tra lịch chạy sao lưu.", lastSuccessAt: "2026-11-17T02:30:00.000Z" },
  config: [{ key: "site-url", label: "Địa chỉ website chính thức (Cài đặt → Tên miền & SEO)", ok: false, required: true, hint: "Thiếu thì sitemap, canonical và Search Console không hoạt động đúng." }],
};

test("Định dạng: dung lượng theo hệ 1024 kiểu Việt Nam, thời gian chạy, thời gian tương đối", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1536), "1,5 KB");
  assert.equal(formatBytes(123_456_789), "117,7 MB");
  assert.equal(formatBytes(100_000_000_000), "93,1 GB");
  assert.equal(formatUptime(3 * 86_400 + 2 * 3_600), "3 ngày 2 giờ");
  assert.equal(formatUptime(5 * 3_600 + 12 * 60), "5 giờ 12 phút");
  assert.equal(formatUptime(10), "1 phút");
  assert.equal(relativeTime("2026-11-19T09:59:40.000Z", now), "vừa xong");
  assert.equal(relativeTime("2026-11-19T09:15:00.000Z", now), "45 phút trước");
  assert.equal(relativeTime("2026-11-19T02:30:00.000Z", now), "7 giờ trước");
  assert.equal(relativeTime("2026-11-16T10:00:00.000Z", now), "3 ngày trước");
});

test("Màn Tình trạng hệ thống: mọi thứ ổn thì nói rõ, liệt kê đủ dịch vụ, không có khung cảnh báo", () => {
  const html = renderToStaticMarkup(<SystemStatusView now={now} onRefresh={() => undefined} status={healthy} />);
  assert.match(html, /Mọi thứ đang ổn/);
  assert.match(html, /production · bản a1b2c3d/);
  for (const label of ["Database \\(PostgreSQL\\)", "Migration database", "Kho tệp \\(S3\\)", "Website", "Thống kê Umami", "Google Search Console", "Máy chủ", "Sao lưu", "Tác vụ định kỳ", "Cấu hình"]) assert.match(html, new RegExp(label), label);
  assert.match(html, /PostgreSQL 17,2|PostgreSQL 17\.2/);
  assert.match(html, /5\/100 kết nối/);
  assert.match(html, /117,7 MB/, "dung lượng database");
  assert.match(html, /3 ngày 2 giờ/, "thời gian chạy");
  assert.match(html, /0,5 \/ 0,4 \/ 0,3 \(4 lõi\)/, "tải CPU");
  assert.match(html, /Kiểm tra lại/);
  assert.doesNotMatch(html, /Có phần cần chú ý|Có phần đang hỏng/);
  assert.doesNotMatch(html, /role="alert"/);
  assert.match(html, /chạy lần cuối 5 giờ trước/);
  assert.match(html, /7 giờ trước/, "bản sao lưu gần nhất");
});

test("Màn Tình trạng hệ thống: có lỗi thì khung đầu trang nêu từng mục, lỗi trước cảnh báo, kèm lý do dễ hiểu", () => {
  const html = renderToStaticMarkup(<SystemStatusView now={now} status={troubled} />);
  assert.match(html, /1 mục lỗi, 2 mục cần chú ý/);
  assert.match(html, /Có phần đang hỏng, cần xử lý ngay/);
  assert.match(html, /role="alert"/);
  const problems = problemsOf(troubled);
  assert.deepEqual(problems.map((item) => item.label), ["Database", "Migration", "Sao lưu", "Cấu hình"]);
  assert.equal(problems[0].state, "error", "lỗi xếp trước cảnh báo");
  assert.match(html, /Không kết nối được database/);
  assert.match(html, /Còn 2 migration chưa áp dụng \(23\/25\)/);
  assert.match(html, /Chưa đặt: Địa chỉ website chính thức/);
  assert.match(html, /Bắt buộc/);
  assert.match(html, /Thiếu thì sitemap, canonical/, "gợi ý cho mục cấu hình còn thiếu");
});

test("Màn Tình trạng hệ thống: Windows không có load average thì chỉ nêu số lõi; không đọc được ổ đĩa thì nói rõ; đang kiểm tra thì khóa nút", () => {
  const server = { ...healthy.server, platform: "win32", disk: undefined };
  delete (server as { loadAverage?: unknown }).loadAverage;
  const html = renderToStaticMarkup(<SystemStatusView checking now={now} status={{ ...healthy, server }} />);
  assert.match(html, /4 lõi/);
  assert.doesNotMatch(html, /0,5 \/ 0,4/);
  assert.match(html, /Không đọc được dung lượng ổ đĩa/);
  assert.match(html, /Đang kiểm tra…/);
  assert.match(html, /disabled/);
});

test("Màn Tình trạng hệ thống chỉ hiển thị số đo và nhãn: không có ô nhập, không có giá trị khóa/chuỗi kết nối", () => {
  const html = renderToStaticMarkup(<SystemStatusView now={now} status={healthy} />);
  assert.doesNotMatch(html, /<input|<textarea|<select|type="file"/);
  const source = readFileSync(path.join(process.cwd(), "apps/admin/src/components/admin/system-status-panel.tsx"), "utf8");
  assert.ok(!/process\.env|DATABASE_URL=|postgres:\/\//.test(source), "màn CMS không đọc biến môi trường");
});

test("Menu Hệ thống có mục Tình trạng hệ thống theo quyền system.view; trang và API đều kiểm quyền đó", () => {
  const item = navigationGroups.find((group) => group.id === "system")!.items.find((entry) => entry.href === "/admin/system");
  assert.equal(item?.label, "Tình trạng hệ thống");
  assert.equal(item?.permission, "system.view");
  const page = readFileSync(path.join(process.cwd(), "apps/admin/src/app/admin/(protected)/system/page.tsx"), "utf8");
  assert.match(page, /requireAdminPermission\("system\.view"\)/);
  const route = readFileSync(path.join(process.cwd(), "apps/api/src/app/api/v1/admin/system-status/route.ts"), "utf8");
  assert.match(route, /denyUnless\(user, "system\.view"\)/);
  assert.ok(!/export const (POST|PUT|PATCH|DELETE)/.test(route), "API chỉ có GET");
});

// Màn này chỉ cần system.view còn các trang đích cần quyền khác: lối tắt chỉ hiện khi người xem mở được trang đó, kẻo bấm vào là "Không có quyền".
const withLinks: SystemStatus = {
  ...healthy,
  config: [
    { key: "site-url", label: "Địa chỉ website chính thức", ok: false, required: true, href: "/admin/seo" },
    { key: "analytics", label: "Thống kê truy cập (Umami)", ok: false, required: false, href: "/admin/integrations" },
    { key: "revalidate-secret", label: "Khóa làm mới website", ok: false, required: true },
  ],
};
const renderFor = (role: string, permissions: string[]) => renderToStaticMarkup(
  <AdminPermissionsProvider actor={{ role, permissions }}><SystemStatusView now={now} status={withLinks} /></AdminPermissionsProvider>,
);

test("Lối tắt: Vận hành hệ thống (chỉ system.view) chỉ thấy lối tắt tới Sao lưu, không thấy trang cài đặt hay khóa API", () => {
  const html = renderFor("sysops", ["dashboard.view", "audit.view", "system.view"]);
  assert.ok(html.includes('href="/admin/backup"'));
  for (const blocked of ["/admin/search-console", "/admin/integrations", "/admin/seo"]) assert.ok(!html.includes(`href="${blocked}"`), `không được dẫn tới ${blocked}`);
});

test("Lối tắt: Super Admin thấy đủ; người có settings.view thấy Tên miền & SEO và Search Console nhưng không thấy khóa API", () => {
  const admin = renderFor("admin", []);
  for (const target of ["/admin/backup", "/admin/search-console", "/admin/integrations", "/admin/seo"]) assert.ok(admin.includes(`href="${target}"`), target);
  const settings = renderFor("custom", ["system.view", "settings.view"]);
  assert.ok(settings.includes('href="/admin/seo"') && settings.includes('href="/admin/search-console"'));
  assert.ok(!settings.includes('href="/admin/integrations"'));
});

test("Lối tắt: chỉ hiện cho mục chưa đặt và có đường dẫn; mục đã ổn hoặc chỉ đặt bằng biến môi trường thì không", () => {
  const html = renderToStaticMarkup(<SystemStatusView now={now} status={{ ...withLinks, config: [{ key: "site-url", label: "Địa chỉ website", ok: true, required: true, href: "/admin/seo" }, { key: "revalidate-secret", label: "Khóa làm mới", ok: false, required: true }] }} />);
  assert.equal((html.match(/href="\/admin\/seo"/g) ?? []).length, 0);
});
