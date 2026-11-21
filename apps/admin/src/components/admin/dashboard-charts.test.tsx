import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DayBars, KpiTile, RingGauge, SegmentLegend, Sparkline, StackedRow } from "./dashboard-charts";

const days = [{ date: "2026-11-17", count: 0 }, { date: "2026-11-18", count: 4 }, { date: "2026-11-19", count: 2 }];

test("Biểu đồ cột: mỗi ngày một vùng rê chuột, chỉ ngày có số mới có cột, nhãn chữ nêu tổng và ngày cao nhất, có bảng số cho cảm ứng và bàn phím", () => {
  const html = renderToStaticMarkup(<DayBars days={days} emptyText="Trống" unit="liên hệ" />);
  assert.equal(html.match(/admin-daybars__hit/g)?.length, 3);
  assert.equal(html.match(/admin-daybars__fill/g)?.length, 2);
  assert.doesNotMatch(html, /admin-tip/, "Chưa rê chuột thì chưa có khung số liệu");
  assert.match(html, /<summary>Xem dạng bảng<\/summary>/);
  assert.match(html, /<td>Thứ Tư, 18\/11\/2026<\/td><td>4<\/td>/);
  assert.match(html, /aria-label="6 liên hệ trong 3 ngày, nhiều nhất 4 vào 18\/11"/);
  assert.match(html, /17\/11/);
});

test("Biểu đồ cột không có số nào: không vẽ cột, không có bảng, hiện câu giải thích thay vì khung rỗng", () => {
  const html = renderToStaticMarkup(<DayBars days={days.map((day) => ({ ...day, count: 0 }))} emptyText="Chưa có khách liên hệ." unit="liên hệ" />);
  assert.doesNotMatch(html, /admin-daybars__fill/);
  assert.doesNotMatch(html, /Xem dạng bảng/);
  assert.match(html, /Chưa có khách liên hệ\./);
  assert.match(html, /Chưa có liên hệ nào trong 3 ngày/);
});

test("Vòng phần trăm: nét theo tỉ lệ, kẹp trong 0–100%; rê chuột ra khung số liệu chi tiết (hoặc nhãn chữ nếu không có)", () => {
  const half = renderToStaticMarkup(<RingGauge label="5 trên 10" max={10} tip={"Đã xuất bản: 5/10\nBài viết: 3/4"} value={5} />);
  assert.match(half, /stroke-dasharray="50.0 100"/);
  assert.match(half, />50%</);
  assert.ok(half.includes('data-tip="Đã xuất bản: 5/10\nBài viết: 3/4"'));
  assert.ok(renderToStaticMarkup(<RingGauge label="5 trên 10" max={10} value={5} />).includes('data-tip="5 trên 10"'));
  assert.match(renderToStaticMarkup(<RingGauge label="x" max={4} value={9} />), /stroke-dasharray="100.0 100"/);
  assert.match(renderToStaticMarkup(<RingGauge label="x" max={0} value={3} />), />0%</);
});

test("Sparkline có đường, vùng tô và điểm cuối; chưa rê chuột thì không có khung số liệu; chuỗi rỗng không lỗi", () => {
  const points = [0, 3, 1, 5].map((count, index) => ({ date: `2026-11-1${index}`, count }));
  const html = renderToStaticMarkup(<Sparkline label="xu hướng" points={points} unit="liên hệ" />);
  assert.match(html, /<polyline[^>]*points="0\.0,/);
  assert.match(html, /admin-spark__dot/);
  assert.doesNotMatch(html, /admin-tip/);
  assert.doesNotThrow(() => renderToStaticMarkup(<Sparkline label="x" points={[]} unit="liên hệ" />));
});

test("Hàng thanh xếp chồng: chỉ vẽ phần có số, độ rộng theo số; rê vào từng đoạn ra trạng thái, số lượng, phần trăm; rê vào tổng ra chi tiết", () => {
  const html = renderToStaticMarkup(<StackedRow href="/admin/news" label="Bài viết" segments={[{ key: "published", value: 6 }, { key: "pending", value: 2 }, { key: "scheduled", value: 0 }, { key: "archived", value: 0 }]} />);
  assert.match(html, /href="\/admin\/news"/);
  assert.equal(html.match(/<i /g)?.length, 2);
  assert.match(html, /flex-grow:6/);
  assert.ok(html.includes('data-tip="Bài viết\nĐã xuất bản: 6 (75%)"'));
  assert.ok(html.includes('data-tip="Bài viết\nBản nháp / chờ duyệt: 2 (25%)"'));
  assert.ok(html.includes('data-tip="Bài viết: 8 mục\nĐã xuất bản: 6\nBản nháp / chờ duyệt: 2"'));
  assert.match(html, />8</);
});

test("Chú giải đủ 4 trạng thái; ô chỉ số là liên kết có nhãn, số lớn, ghi chú và hình", () => {
  assert.equal(renderToStaticMarkup(<SegmentLegend />).match(/admin-legend__dot/g)?.length, 4);
  const tile = renderToStaticMarkup(<KpiTile href="/admin/leads" label="Khách liên hệ" note="3 mới" value="12" visual={<span>hinh</span>} />);
  assert.match(tile, /<a[^>]*href="\/admin\/leads"/);
  assert.match(tile, /<strong>12<\/strong>/);
});
