import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { SearchConsoleOverview } from "@iorder/shared/server/search-console/search-console.contract";
import { SearchConsoleSummary } from "./search-console-card";
import { SearchConsoleQueriesList } from "./ui/search-console-queries";

const connected: SearchConsoleOverview = {
  connection: "connected", property: "sc-domain:iorder.vn", period: { startDate: "2026-10-20", endDate: "2026-11-16" },
  totals: { clicks: 34, impressions: 12_345, ctr: 0.0028, position: 9.24 },
  topQueries: [],
  opportunities: [
    { query: "phần mềm quản lý bán hàng", clicks: 4, impressions: 800, ctr: 0.005, position: 12.4, reason: "near_page_one" },
    { query: "máy in bếp", clicks: 3, impressions: 500, ctr: 0.012, position: 5.2, reason: "low_ctr" },
  ],
};

test("Thẻ Tổng quan: chưa nối thì nói rõ cách nối, không hiện số liệu giả", () => {
  const html = renderToStaticMarkup(<SearchConsoleSummary overview={{ connection: "not_configured" }} />);
  assert.match(html, /Chưa nối Google Search Console/);
  assert.match(html, /href="\/admin\/search-console"/);
  assert.doesNotMatch(html, /lượt hiện/);
});

test("Thẻ Tổng quan: lỗi hiện nguyên lời giải thích dễ hiểu, vai trò alert", () => {
  const html = renderToStaticMarkup(<SearchConsoleSummary overview={{ connection: "error", message: "Google chưa cho phép tài khoản “a@b.iam.gserviceaccount.com” đọc dữ liệu." }} />);
  assert.match(html, /role="alert"/);
  assert.match(html, /a@b\.iam\.gserviceaccount\.com/);
});

test("Thẻ Tổng quan: số liệu 28 ngày theo định dạng Việt Nam và danh sách cơ hội kèm lý do, liên kết sang Google mở tab mới", () => {
  const html = renderToStaticMarkup(<SearchConsoleSummary overview={connected} />);
  assert.match(html, /12\.345 lượt hiện · 34 lượt bấm · hạng trung bình 9,2/);
  assert.match(html, /đến 16\/11\/2026/);
  assert.match(html, /<strong>phần mềm quản lý bán hàng<\/strong><small>Gần trang đầu · hạng 12,4 · 800 lượt hiện · 0,5% bấm<\/small>/);
  assert.match(html, /Ít người bấm · hạng 5,2/);
  const link = /<a ([^>]*)><i/.exec(html)?.[1] ?? "";
  assert.match(link, /href="https:\/\/www\.google\.com\/search\?q=ph%E1%BA%A7n/);
  assert.match(link, /target="_blank"/);
  assert.match(link, /rel="noreferrer"/);
});

test("Thẻ Tổng quan: chưa có cơ hội nào thì giải thích vì sao, không để trống", () => {
  const html = renderToStaticMarkup(<SearchConsoleSummary overview={{ ...connected, connection: "connected", opportunities: [] } as SearchConsoleOverview} />);
  assert.match(html, /Chưa có cụm nào đủ dữ liệu/);
});

test("Mục 'Khách đang tìm gì' trong trợ lý SEO: danh sách kèm nút điền từ khóa chỉ khi nơi dùng truyền onUse; các trạng thái khác nói rõ", () => {
  const result = { connection: "connected" as const, period: { startDate: "2026-10-20", endDate: "2026-11-16" }, queries: [{ query: "phần mềm pos", clicks: 3, impressions: 250, ctr: 0.012, position: 8.6 }] };
  const withButton = renderToStaticMarkup(<SearchConsoleQueriesList onUse={() => undefined} result={result} />);
  assert.match(withButton, /<strong>phần mềm pos<\/strong><small>hạng 8,6 · 250 lượt hiện · 3 lượt bấm<\/small>/);
  assert.match(withButton, /Dùng làm từ khóa chính/);
  assert.doesNotMatch(renderToStaticMarkup(<SearchConsoleQueriesList result={result} />), /Dùng làm từ khóa chính/);
  assert.match(renderToStaticMarkup(<SearchConsoleQueriesList result={{ ...result, queries: [] }} />), /Chưa có cụm nào/);
  assert.match(renderToStaticMarkup(<SearchConsoleQueriesList result={{ connection: "not_configured" }} />), /Chưa nối Google Search Console/);
  assert.match(renderToStaticMarkup(<SearchConsoleQueriesList result={{ connection: "error", message: "Lỗi mẫu" }} />), /role="alert"[^>]*>Lỗi mẫu/);
});
