import assert from "node:assert/strict";
import test from "node:test";

import { contentSegments, seoAverageScore, sumDays } from "./dashboard-metrics";

test("Phần lưu trữ là phần còn lại của tổng; không bao giờ âm", () => {
  assert.deepEqual(contentSegments({ total: 10, published: 6, pending: 2, scheduled: 1 }).map((s) => [s.key, s.value]), [["published", 6], ["pending", 2], ["scheduled", 1], ["archived", 1]]);
  assert.equal(contentSegments({ total: 3, published: 6, pending: 2, scheduled: 1 })[3].value, 0);
});

test("Tổng số theo chuỗi ngày", () => {
  assert.equal(sumDays([{ date: "2026-11-18", count: 2 }, { date: "2026-11-19", count: 5 }]), 7);
  assert.equal(sumDays([]), 0);
});

test("Điểm SEO trung bình gộp mọi mục của mọi nội dung (không phải trung bình các phần trăm); chưa có nội dung thì null", () => {
  const row = (passed: number, total: number) => ({ score: { passed, total } }) as never;
  assert.equal(seoAverageScore({ rows: [row(3, 6)], healthy: [row(9, 9)] }), 80);
  assert.equal(seoAverageScore({ rows: [], healthy: [] }), null);
});

test("Chỉ số điểm theo vị trí con trỏ: làm tròn tới điểm gần nhất, kẹp trong khoảng, không lỗi khi rỗng", async () => {
  const { indexFromPosition } = await import("./dashboard-metrics");
  assert.equal(indexFromPosition(0, 100, 5), 0);
  assert.equal(indexFromPosition(100, 100, 5), 4);
  assert.equal(indexFromPosition(51, 100, 5), 2);
  assert.equal(indexFromPosition(-20, 100, 5), 0);
  assert.equal(indexFromPosition(500, 100, 5), 4);
  assert.equal(indexFromPosition(10, 100, 1), 0);
  assert.equal(indexFromPosition(10, 0, 5), null);
  assert.equal(indexFromPosition(10, 100, 0), null);
});

test("Ngày dài có thứ trong tuần, đọc theo ngày Việt Nam đã chọn (không lệch múi giờ)", async () => {
  const { formatLongDate } = await import("./dashboard-metrics");
  assert.match(formatLongDate("2026-11-19"), /Thứ Năm.*19\/11\/2026/);
  assert.match(formatLongDate("2026-11-22"), /Chủ Nhật.*22\/11\/2026/);
});
