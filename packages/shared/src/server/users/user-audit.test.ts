import assert from "node:assert/strict";
import { test } from "node:test";
import { userAuditSnapshot } from "./user-audit";

test("Audit tài khoản chỉ ghi trường cho phép, không ghi hash hoặc secret mới", () => {
  const row = { id: "u1", username: "audit", email: null, fullName: "Kiểm thử", status: "active", passwordHash: "khong-duoc-ghi", token: "khong-duoc-ghi" };
  assert.deepEqual(userAuditSnapshot(row), { id: "u1", username: "audit", email: null, fullName: "Kiểm thử", status: "active" });
  assert.equal(row.passwordHash, "khong-duoc-ghi");
});
test("Tạo mới không có snapshot trước", () => {
  assert.equal(userAuditSnapshot(undefined), null);
});
