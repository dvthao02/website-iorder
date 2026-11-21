import assert from "node:assert/strict";
import { test } from "node:test";

import { changeOwnPasswordSchema, updateOwnProfileSchema } from "./account.contract";

test("Mật khẩu mới cần ít nhất 10 ký tự và khác mật khẩu hiện tại", () => {
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "matkhaucu123", newPassword: "matkhaumoi456" }).success, true);
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "matkhaucu123", newPassword: "ngan" }).success, false);
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "trungnhau123", newPassword: "trungnhau123" }).success, false);
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "", newPassword: "matkhaumoi456" }).success, false);
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "a", newPassword: "matkhaumoi456", extra: 1 }).success, false);
});

test("Hồ sơ: cắt khoảng trắng, ô trống thành null, họ tên bắt buộc", () => {
  const parsed = updateOwnProfileSchema.parse({ fullName: "  Nguyễn Văn A  ", email: "  a@iorder.vn ", phone: "0901 234 567" });
  assert.deepEqual(parsed, { fullName: "Nguyễn Văn A", email: "a@iorder.vn", phone: "0901 234 567" });
  assert.deepEqual(updateOwnProfileSchema.parse({ fullName: "A", email: "   ", phone: "" }), { fullName: "A", email: null, phone: null });
  assert.equal(updateOwnProfileSchema.safeParse({ fullName: "   ", email: null, phone: null }).success, false);
  assert.equal(updateOwnProfileSchema.safeParse({ fullName: "x".repeat(181), email: null, phone: null }).success, false);
});

test("Hồ sơ: email và số điện thoại sai định dạng bị từ chối với thông báo tiếng Việt", () => {
  const badEmail = updateOwnProfileSchema.safeParse({ fullName: "A", email: "khong-phai-email", phone: null });
  assert.equal(badEmail.success, false);
  assert.equal(badEmail.error?.issues[0]?.message, "Email chưa đúng định dạng.");
  for (const phone of ["abc12345", "12345", "++++++++", "090-abc-1234"]) {
    assert.equal(updateOwnProfileSchema.safeParse({ fullName: "A", email: null, phone }).success, false, phone);
  }
  for (const phone of ["0901234567", "+84 901 234 567", "(028) 3822.1234"]) {
    assert.equal(updateOwnProfileSchema.safeParse({ fullName: "A", email: null, phone }).success, true, phone);
  }
});

test("Hồ sơ: thiếu trường hoặc thừa trường là lỗi, để API không xóa nhầm email/số điện thoại", () => {
  assert.equal(updateOwnProfileSchema.safeParse({ fullName: "A" }).success, false);
  assert.equal(updateOwnProfileSchema.safeParse({ fullName: "A", email: null }).success, false);
  assert.equal(updateOwnProfileSchema.safeParse({ fullName: "A", email: null, phone: null, username: "doi-ten" }).success, false);
});
