import assert from "node:assert/strict";
import test from "node:test";

import { matchesRestoreConfirmation } from "./restore-confirm";

test("Xác nhận phục hồi nhận cả gõ có dấu, không dấu, hoa thường và khoảng trắng thừa", () => {
  for (const typed of ["phục hồi", "PHỤC HỒI", "phuc hoi", "Phuc Hoi", "  phục   hồi  ", "phụ̣c hồi"]) assert.equal(matchesRestoreConfirmation(typed), true, typed);
});

test("Xác nhận phục hồi từ chối mọi thứ khác, kể cả rỗng hoặc chỉ gõ một nửa", () => {
  for (const typed of ["", "phục", "hồi", "phuchoi", "xóa", "phục hồi dữ liệu", "15:17 4/11/26"]) assert.equal(matchesRestoreConfirmation(typed), false, typed);
});
