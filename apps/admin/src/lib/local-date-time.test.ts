import assert from "node:assert/strict";
import test from "node:test";
import { formatDisplayDateTime, formatLocalDateTime } from "./local-date-time";

test("datetime-local giữ giờ địa phương và round-trip đúng phút", () => {
  for (const date of [new Date(2026, 9, 12, 9, 5), new Date(2026, 0, 1, 0, 0), new Date(2026, 11, 31, 23, 59)]) {
    const text = formatLocalDateTime(date);
    const roundTrip = new Date(text);
    assert.equal(roundTrip.getTime(), date.getTime());
    assert.equal(formatLocalDateTime(date.toISOString()), text);
  }
  assert.equal(formatLocalDateTime(new Date(2026, 9, 12, 9, 5)), "2026-10-12T09:05");
});
test("ngày thiếu hoặc lỗi không throw khi render form", () => {
  for (const value of [null, undefined, "", "sai", new Date(NaN)]) assert.equal(formatLocalDateTime(value), "");
});
test("ngày giờ hiển thị: ngày/tháng/năm đủ 4 số rồi giờ; dữ liệu lỗi thành chuỗi rỗng", () => {
  assert.equal(formatDisplayDateTime(new Date(2026, 9, 19, 22, 15)), "19/10/2026 22:15");
  assert.equal(formatDisplayDateTime(new Date(2026, 0, 5, 9, 5)), "05/01/2026 09:05");
  for (const value of [null, undefined, "", "sai"]) assert.equal(formatDisplayDateTime(value), "");
});
