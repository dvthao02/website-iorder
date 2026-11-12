import assert from "node:assert/strict";
import { test } from "node:test";

import { changeOwnPasswordSchema } from "./account.contract";

test("Mật khẩu mới cần ít nhất 10 ký tự và khác mật khẩu hiện tại", () => {
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "matkhaucu123", newPassword: "matkhaumoi456" }).success, true);
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "matkhaucu123", newPassword: "ngan" }).success, false);
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "trungnhau123", newPassword: "trungnhau123" }).success, false);
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "", newPassword: "matkhaumoi456" }).success, false);
  assert.equal(changeOwnPasswordSchema.safeParse({ currentPassword: "a", newPassword: "matkhaumoi456", extra: 1 }).success, false);
});
