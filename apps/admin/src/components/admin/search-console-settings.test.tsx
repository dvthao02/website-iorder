import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { SearchConsoleDiagnosis } from "@iorder/shared/server/search-console/search-console.contract";
import { SearchConsoleSettingsView, searchConsoleStatus } from "./search-console-settings";

// AdminCard/AdminNotice dùng JSX kiểu cũ (không tự import React) nên test cần React toàn cục.
(globalThis as { React?: typeof React }).React = React;

const email = "cms@du-an.iam.gserviceaccount.com";
const connected: SearchConsoleDiagnosis = {
  configured: true, source: "file", propertyFromSetting: false, email, websiteUrl: "https://iorder.vn",
  sites: [{ siteUrl: "sc-domain:iorder.vn", permissionLevel: "siteRestrictedUser" }],
  property: "sc-domain:iorder.vn", period: { startDate: "2026-10-20", endDate: "2026-11-16" }, sampleQueries: 5,
};

test("Màn Search Console: chưa đặt khóa thì nói rõ là chưa nối và khóa chỉ đặt ở máy chủ, vẫn có hướng dẫn và nút kiểm tra", () => {
  const html = renderToStaticMarkup(<SearchConsoleSettingsView diagnosis={{ configured: false }} onCheck={() => undefined} />);
  assert.equal(searchConsoleStatus({ configured: false }).label, "Chưa nối");
  assert.match(html, /Chưa nối/);
  assert.match(html, /Super Admin nhập ở/);
  assert.match(html, /href="\/admin\/integrations"/);
  assert.match(html, /GOOGLE_SERVICE_ACCOUNT_FILE/);
  assert.match(html, /GOOGLE_SERVICE_ACCOUNT_JSON/);
  assert.match(html, /Kiểm tra kết nối/);
  assert.match(html, /Cách nối \(làm một lần\)/);
  assert.doesNotMatch(html, /Đã nối/);
});

test("Màn Search Console: nối được thì hiện email để thêm vào Search Console, thuộc tính, website thấy với quyền dịch ra tiếng Việt", () => {
  const html = renderToStaticMarkup(<SearchConsoleSettingsView diagnosis={connected} onCopyEmail={() => undefined} />);
  assert.equal(searchConsoleStatus(connected).tone, "success");
  assert.match(html, /Đã nối/);
  assert.ok(html.includes(email), "email tài khoản dịch vụ để người vận hành sao chép");
  assert.match(html, /Sao chép/);
  assert.match(html, /sc-domain:iorder\.vn/);
  assert.match(html, /Hạn chế \(chỉ đọc\)/);
  assert.match(html, /Tệp trên máy chủ/);
  assert.match(html, /5 cụm tìm kiếm mẫu/);
  assert.match(html, /20\/10\/2026/);
  assert.match(html, /href="\/admin"/, "dẫn về thẻ Cơ hội trên Google ở Bảng điều khiển");
});

test("Màn Search Console: nối được nhưng chưa có số liệu thì không nói đã có cụm tìm kiếm", () => {
  const html = renderToStaticMarkup(<SearchConsoleSettingsView diagnosis={{ ...connected, sampleQueries: 0 } as SearchConsoleDiagnosis} />);
  assert.match(html, /chưa có cụm tìm kiếm nào/);
  assert.doesNotMatch(html, /cụm tìm kiếm mẫu/);
});

test("Màn Search Console: lỗi hiện nguyên lý do dễ hiểu (role alert), trạng thái Chưa được, vẫn thấy website tài khoản có; thuộc tính ép bằng biến được nêu", () => {
  const problem = `Google chưa cho phép tài khoản “${email}” đọc dữ liệu. Thêm email đó vào Search Console.`;
  const failing: SearchConsoleDiagnosis = { configured: true, source: "json", propertyFromSetting: true, email, websiteUrl: null, sites: [], problem };
  const html = renderToStaticMarkup(<SearchConsoleSettingsView diagnosis={failing} />);
  assert.equal(searchConsoleStatus(failing).tone, "error");
  assert.match(html, /Chưa được/);
  assert.match(html, /role="alert"/);
  assert.ok(html.includes(email));
  assert.match(html, /Chưa thấy website nào/);
  assert.match(html, /Chưa đặt/, "chưa khai địa chỉ website");
  assert.match(html, /Biến GOOGLE_SERVICE_ACCOUNT_JSON/);
  assert.match(html, /Đặt cố định bằng SEARCH_CONSOLE_PROPERTY/);
  assert.doesNotMatch(html, /Đã nối/);
});

test("Màn Search Console: đang kiểm tra thì khóa nút; không có onCopyEmail thì không hiện nút sao chép", () => {
  const checking = renderToStaticMarkup(<SearchConsoleSettingsView checking diagnosis={connected} />);
  assert.match(checking, /Đang kiểm tra…/);
  assert.match(checking, /disabled/);
  assert.doesNotMatch(checking, /Sao chép/);
});

test("Màn Search Console không bao giờ nhận hay hiển thị khóa: không có ô nhập khóa, mã nguồn không đọc private_key", () => {
  const html = renderToStaticMarkup(<SearchConsoleSettingsView diagnosis={connected} onCheck={() => undefined} onCopyEmail={() => undefined} />);
  assert.doesNotMatch(html, /<input|<textarea|type="file"/);
  const source = readFileSync(path.join(process.cwd(), "apps/admin/src/components/admin/search-console-settings.tsx"), "utf8");
  assert.ok(!/private_key|BEGIN [A-Z ]*PRIVATE KEY/.test(source), "màn CMS không xử lý khóa riêng");
});

test("Menu Cài đặt có mục Google Search Console, chỉ cho người có quyền xem cài đặt; thẻ Tổng quan dẫn tới màn này", () => {
  const shell = readFileSync(path.join(process.cwd(), "apps/admin/src/components/admin/admin-shell.tsx"), "utf8");
  assert.match(shell, /href: "\/admin\/search-console", label: "Google Search Console", icon: SearchCheck, permission: "settings\.view"/);
  const page = readFileSync(path.join(process.cwd(), "apps/admin/src/app/admin/(protected)/search-console/page.tsx"), "utf8");
  assert.match(page, /requireAdminPermission\("settings\.view"\)/);
});
