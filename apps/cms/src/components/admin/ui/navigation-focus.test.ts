import assert from "node:assert/strict";
import test from "node:test";
import { consumeNavigationFocus, requestNavigationFocus } from "./navigation-focus";

test("Focus chỉ dành cho URL đích, không phụ thuộc thứ tự query và dùng một lần", () => {
  requestNavigationFocus("/admin/doi-tac?kind=partners&page=1", 100);
  assert.equal(consumeNavigationFocus("/admin/tai-khoan", 101), false);
  assert.equal(consumeNavigationFocus("http://localhost:3001/admin/doi-tac?page=1&kind=partners", 102), true);
  assert.equal(consumeNavigationFocus("/admin/doi-tac?kind=partners&page=1", 103), false);
});
test("Yêu cầu mới thay thế cũ; focus hết hạn không được phục hồi", () => {
  requestNavigationFocus("/admin/doi-tac?kind=partners", 100);
  requestNavigationFocus("/admin/doi-tac?kind=testimonials", 101);
  assert.equal(consumeNavigationFocus("/admin/doi-tac?kind=partners", 102), false);
  assert.equal(consumeNavigationFocus("/admin/doi-tac?kind=testimonials", 10101), false);
  assert.equal(consumeNavigationFocus("/admin/doi-tac?kind=testimonials", 10102), false);
});
