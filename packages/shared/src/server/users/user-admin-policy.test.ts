import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { assertActiveAdministratorRemains } from "./user-admin-policy";

test("Không hạ quyền/khóa admin hoạt động cuối cùng", () => {
  assert.throws(() => assertActiveAdministratorRemains(true, false, 1), z.ZodError);
});
test("Cho phép giảm khi còn admin khác và giữ nguyên admin cuối", () => {
  assert.doesNotThrow(() => assertActiveAdministratorRemains(true, false, 2));
  assert.doesNotThrow(() => assertActiveAdministratorRemains(true, true, 1));
});
test("Không chặn sửa editor hoặc user đã disabled chỉ vì còn một admin", () => {
  assert.doesNotThrow(() => assertActiveAdministratorRemains(false, false, 1));
  assert.doesNotThrow(() => assertActiveAdministratorRemains(false, true, 0));
});
