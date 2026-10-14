import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { createAdminListPageSchema } from "./admin-list.contract";
const schema = createAdminListPageSchema(z.object({ id: z.string().uuid() }));
const row = { id: "11111111-1111-4111-8111-111111111111" };
test("Metadata danh sách đúng và trang vượt giới hạn rỗng được phép", () => {
  assert.ok(schema.safeParse({ items: [row], page: 1, pageSize: 7, total: 1, totalPages: 1 }).success);
  assert.ok(schema.safeParse({ items: [], page: 999, pageSize: 7, total: 1, totalPages: 1 }).success);
});
test("Từ chối tổng sai, số hàng sai, ID trùng hoặc item không hợp lệ", () => {
  const value = { items: [row], page: 1, pageSize: 7, total: 1, totalPages: 1 };
  for (const bad of [{ ...value, totalPages: 2 }, { ...value, total: 2 }, { ...value, total: 2, items: [row, row] }, { ...value, items: [{ id: "sai" }] }, { ...value, pageSize: 101 }]) assert.equal(schema.safeParse(bad).success, false);
});
