import assert from "node:assert/strict";
import test from "node:test";

import { defaultDashboardRange, parseDashboardRange } from "./dashboard-range";

test("Chỉ nhận 7, 30, 90 ngày (chuỗi hoặc số); giá trị lạ dùng mặc định 30", () => {
  assert.equal(parseDashboardRange("7"), 7);
  assert.equal(parseDashboardRange(90), 90);
  assert.equal(parseDashboardRange(" 30 "), 30);
  for (const value of ["", "1", "365", "abc", "7.5", "-7", null, undefined, Number.NaN]) assert.equal(parseDashboardRange(value as never), defaultDashboardRange);
});
