import assert from "node:assert/strict";
import { test } from "node:test";
import { auditActionLabel, auditEntityLabel } from "./audit-labels";
import { auditLabelSearchCodes } from "@iorder/core/server/audit/audit-labels";

test("Nhãn nhật ký dịch đúng mã thao tác đang được phát sinh", () => {
  assert.equal(auditEntityLabel("equipment_group"), "Nhóm thiết bị");
  assert.equal(auditActionLabel("equipment.update"), "Cập nhật · Thiết bị");
  assert.equal(auditActionLabel("lead.status_update"), "Cập nhật trạng thái · Liên hệ khách hàng");
  assert.equal(auditActionLabel("media.delete_queue"), "Đưa vào hàng đợi xóa · Hình ảnh và tệp");
  assert.equal(auditActionLabel("navigation.update"), "Cập nhật · Menu điều hướng");
  assert.equal(auditActionLabel("support_download.restore"), "Khôi phục · Tệp hỗ trợ");
});
test("Mã lạ, nhiều segment và property prototype không bị dịch nhầm", () => {
  for (const code of ["", "unknown", "unknown.update", "equipment.unknown", "equipment.update.extra", "__proto__.update", "equipment.toString"]) assert.equal(auditActionLabel(code), code);
  for (const code of ["unknown", "__proto__", "constructor", "toString"]) assert.equal(auditEntityLabel(code), code);
});
test("Search nhãn chuẩn hóa Unicode, không tạo điều kiện cho từ khóa rỗng", () => {
  assert.deepEqual(auditLabelSearchCodes(""), { actions: [], entityTypes: [] });
  const expected = auditLabelSearchCodes("Cập nhật");
  assert.ok(expected.actions.includes("equipment.update"));
  assert.deepEqual(auditLabelSearchCodes("Cập nhật".normalize("NFD")), expected);
  assert.deepEqual(auditLabelSearchCodes("CẬP NHẬT"), expected);
  assert.deepEqual(auditLabelSearchCodes("không có nhãn này"), { actions: [], entityTypes: [] });
});
