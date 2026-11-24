import assert from "node:assert/strict";
import { test } from "node:test";

import { formatTimeAgo, formatWaitingTime } from "./relative-time";

const now = new Date("2026-11-24T08:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

test("Thời gian đã trôi qua: vừa xong, phút, giờ, ngày, tháng", () => {
  assert.equal(formatTimeAgo(ago(0), now), "vừa xong");
  assert.equal(formatTimeAgo(ago(59_999), now), "vừa xong");
  assert.equal(formatTimeAgo(ago(minute), now), "1 phút trước");
  assert.equal(formatTimeAgo(ago(59 * minute + 59_000), now), "59 phút trước");
  assert.equal(formatTimeAgo(ago(hour), now), "1 giờ trước");
  assert.equal(formatTimeAgo(ago(23 * hour + 59 * minute), now), "23 giờ trước");
  assert.equal(formatTimeAgo(ago(day), now), "1 ngày trước");
  assert.equal(formatTimeAgo(ago(29 * day), now), "29 ngày trước");
  assert.equal(formatTimeAgo(ago(30 * day), now), "1 tháng trước");
  assert.equal(formatTimeAgo(ago(75 * day), now), "2 tháng trước");
});

test("Thời điểm ở tương lai (lệch đồng hồ) coi như vừa xong", () => {
  assert.equal(formatTimeAgo(new Date(now.getTime() + 5 * minute), now), "vừa xong");
  assert.equal(formatWaitingTime(new Date(now.getTime() + 5 * minute), now), "1 phút");
});

test("Khoảng đã chờ không có chữ trước và tối thiểu 1 phút", () => {
  assert.equal(formatWaitingTime(ago(10_000), now), "1 phút");
  assert.equal(formatWaitingTime(ago(20 * minute), now), "20 phút");
  assert.equal(formatWaitingTime(ago(5 * hour + 30 * minute), now), "5 giờ");
  assert.equal(formatWaitingTime(ago(day), now), "1 ngày");
  assert.equal(formatWaitingTime(ago(3 * day + 5 * hour), now), "3 ngày");
});
