import assert from "node:assert/strict";
import test from "node:test";

import { fileNameFromDisposition } from "./download-file";

test("Tên file tải về lấy từ Content-Disposition của máy chủ, không có thì dùng tên dự phòng", () => {
  assert.equal(fileNameFromDisposition('attachment; filename="ban-dich-en-2026-11-25.xlsx"', "x.xlsx"), "ban-dich-en-2026-11-25.xlsx");
  assert.equal(fileNameFromDisposition("attachment; filename=ban-dich-en-chua-dich-2026-11-25.csv", "x.csv"), "ban-dich-en-chua-dich-2026-11-25.csv");
  assert.equal(fileNameFromDisposition("attachment; filename*=UTF-8''b%E1%BA%A3n-d%E1%BB%8Bch.xlsx", "x.xlsx"), "bản-dịch.xlsx");
  assert.equal(fileNameFromDisposition(null, "du-phong.xlsx"), "du-phong.xlsx");
  assert.equal(fileNameFromDisposition("inline", "du-phong.xlsx"), "du-phong.xlsx");
});

test("Tên file có dấu gạch đường dẫn hoặc mã hóa hỏng thì bỏ, dùng tên dự phòng (không để máy chủ chọn thư mục lưu)", () => {
  assert.equal(fileNameFromDisposition('attachment; filename="../../evil.exe"', "an-toan.xlsx"), "an-toan.xlsx");
  assert.equal(fileNameFromDisposition('attachment; filename="a\\b.xlsx"', "an-toan.xlsx"), "an-toan.xlsx");
  assert.equal(fileNameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A", "an-toan.xlsx"), "an-toan.xlsx");
});
