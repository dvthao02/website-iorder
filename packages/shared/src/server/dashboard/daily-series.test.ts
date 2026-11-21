import assert from "node:assert/strict";
import test from "node:test";

import { dailySeriesStart, fillDailySeries, vietnamDateKey } from "./daily-series";

test("Ngày tính theo giờ Việt Nam: 18:00 UTC đã sang ngày hôm sau", () => {
  assert.equal(vietnamDateKey(new Date("2026-11-19T16:59:00Z")), "2026-11-19");
  assert.equal(vietnamDateKey(new Date("2026-11-19T17:00:00Z")), "2026-11-20");
});

test("Chuỗi ngày liên tiếp, ngày trống là 0, nhiều dòng cùng ngày được cộng, dòng ngoài khoảng bị bỏ", () => {
  const series = fillDailySeries([
    { date: "2026-11-19", count: 2 }, { date: "2026-11-19", count: 3 }, { date: "2026-11-17", count: 1 }, { date: "2026-10-01", count: 9 },
  ], 4, new Date("2026-11-19T05:00:00Z"));
  assert.deepEqual(series, [
    { date: "2026-11-16", count: 0 }, { date: "2026-11-17", count: 1 }, { date: "2026-11-18", count: 0 }, { date: "2026-11-19", count: 5 },
  ]);
});

test("Mốc bắt đầu là 00:00 giờ Việt Nam của ngày cũ nhất", () => {
  assert.equal(dailySeriesStart(30, new Date("2026-11-19T05:00:00Z")).toISOString(), "2026-10-20T17:00:00.000Z");
  assert.equal(dailySeriesStart(1, new Date("2026-11-19T05:00:00Z")).toISOString(), "2026-11-18T17:00:00.000Z");
});
