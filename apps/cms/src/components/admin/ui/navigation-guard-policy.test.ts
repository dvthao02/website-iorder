import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldConfirmHistoryNavigation, shouldConfirmNavigation } from "./navigation-guard-policy";

const intent = { href: "/admin/pages", currentHref: "http://localhost:3001/admin/thiet-bi/moi", target: "", download: false, modified: false, button: 0 };
const historyIntent = { href: intent.href, currentHref: intent.currentHref, navigationType: "traverse", cancelable: true };

test("History nội bộ có thể hủy cần guard; không chặn push/replace/reload", () => {
  assert.equal(shouldConfirmHistoryNavigation(historyIntent), true);
  for (const navigationType of ["push", "replace", "reload"]) {
    assert.equal(shouldConfirmHistoryNavigation({ ...historyIntent, navigationType }), false);
  }
});
test("History không hủy được, anchor/cùng URL/khác origin không giả định chặn được", () => {
  assert.equal(shouldConfirmHistoryNavigation({ ...historyIntent, cancelable: false }), false);
  for (const href of ["#seo", intent.currentHref, "https://example.com"]) {
    assert.equal(shouldConfirmHistoryNavigation({ ...historyIntent, href }), false);
  }
  assert.equal(shouldConfirmHistoryNavigation({ ...historyIntent, href: "?edit=khac" }), true);
});

test("Link sidebar và đổi query cần xác nhận", () => {
  assert.equal(shouldConfirmNavigation(intent), true);
  assert.equal(shouldConfirmNavigation({ ...intent, href: "?edit=khac" }), true);
});
test("Anchor và URL hiện tại không rời form", () => {
  assert.equal(shouldConfirmNavigation({ ...intent, href: "#seo" }), false);
  assert.equal(shouldConfirmNavigation({ ...intent, href: intent.currentHref }), false);
});
test("Tab mới, modifier, download và chuột giữa không bị chặn", () => {
  for (const patch of [{ target: "_blank" }, { modified: true }, { download: true }, { button: 1 }]) {
    assert.equal(shouldConfirmNavigation({ ...intent, ...patch }), false);
  }
});
test("Link ngoài và protocol khác để beforeunload/browser xử lý", () => {
  for (const href of ["https://example.com", "mailto:support@example.com", "tel:0123456789"]) {
    assert.equal(shouldConfirmNavigation({ ...intent, href }), false);
  }
});
