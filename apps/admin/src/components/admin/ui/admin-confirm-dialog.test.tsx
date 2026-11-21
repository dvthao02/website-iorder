import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminConfirmProvider, resolveAdminConfirmOptions } from "./admin-confirm-dialog";
import { isTopAdminFocusTrap, pushAdminFocusTrap } from "./admin-focus-trap";

test("Hộp xác nhận dùng nhãn và tone mặc định", () => {
  assert.deepEqual(resolveAdminConfirmOptions({ title: "Xác nhận", message: "Bạn có muốn tiếp tục?" }), {
    cancelLabel: "Hủy",
    confirmLabel: "Xác nhận",
    message: "Bạn có muốn tiếp tục?",
    title: "Xác nhận",
    tone: "default",
  });
});

test("Provider hiển thị nội dung con trước khi có yêu cầu xác nhận", () => {
  const html = renderToStaticMarkup(<AdminConfirmProvider><span>Nội dung CMS</span></AdminConfirmProvider>);

  assert.match(html, /Nội dung CMS/);
  assert.doesNotMatch(html, /role="alertdialog"/);
});

test("Chỉ focus trap mở sau cùng xử lý phím, trap dưới lấy lại quyền khi trap trên đóng", () => {
  const panel = {};
  const dialog = {};
  const releasePanel = pushAdminFocusTrap(panel);
  const releaseDialog = pushAdminFocusTrap(dialog);

  assert.equal(isTopAdminFocusTrap(dialog), true);
  assert.equal(isTopAdminFocusTrap(panel), false);

  releaseDialog();
  assert.equal(isTopAdminFocusTrap(panel), true);

  releasePanel();
  assert.equal(isTopAdminFocusTrap(panel), false);
});
