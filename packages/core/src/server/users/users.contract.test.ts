import assert from "node:assert/strict";
import test from "node:test";
import { cmsUserListPageSchema, cmsUserListQuerySchema, cmsUserRequestSchema, cmsUserSaveResponseSchema } from "./users.contract";

test("Phản hồi lưu tài khoản chỉ nhận UUID, không mang hash/mật khẩu", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(cmsUserSaveResponseSchema.parse({ id, passwordHash: "fixture", password: "fixture" }), { id });
  for (const value of [{}, { id: "" }, { id: "khong-phai-id" }, { id: 123 }, { id: null }]) assert.equal(cmsUserSaveResponseSchema.safeParse(value).success, false);
});

test("Phản hồi danh sách kiểm metadata, ID trùng và bỏ mật khẩu/hash", () => {
  const empty = { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1, counts: { all: 2, active: 1, admins: 1 } };
  assert.equal(cmsUserListPageSchema.safeParse(empty).success, true);
  const user = { id: "11111111-1111-4111-8111-111111111111", username: "fixture", email: null, fullName: "Người thử", role: "editor", status: "active", lastLoginAt: null };
  const result = cmsUserListPageSchema.parse({ ...empty, total: 1, items: [{ ...user, password: "fixture", passwordHash: "fixture" }] });
  assert.deepEqual(result.items, [user]);
  for (const patch of [{ total: 1 }, { totalPages: 2 }, { pageSize: 101 }, { counts: { all: 1, active: 2, admins: 0 } }, { counts: { all: 2, active: 1, admins: 2 } }]) assert.equal(cmsUserListPageSchema.safeParse({ ...empty, ...patch }).success, false);
  assert.equal(cmsUserListPageSchema.safeParse({ ...empty, total: 2, items: [user, user] }).success, false);
  assert.equal(cmsUserListPageSchema.safeParse({ ...empty, total: 1, items: [{ ...user, lastLoginAt: "sai" }] }).success, false);
});

test("Bộ lọc tài khoản giới hạn phân trang, role/status và không nhận trường mật khẩu", () => {
  assert.deepEqual(cmsUserListQuerySchema.parse({}), { page: 1, pageSize: 25, query: "", status: "all", role: "all" });
  const input = { page: "2", pageSize: "5", query: "  Nguyễn Văn  ", status: "disabled", role: "editor" };
  assert.deepEqual(cmsUserListQuerySchema.parse(input), { page: 2, pageSize: 5, query: "Nguyễn Văn", status: "disabled", role: "editor" });
  assert.equal(input.query, "  Nguyễn Văn  ");
  for (const invalid of [{ page: 0 }, { page: 1.5 }, { pageSize: 101 }, { pageSize: 4 }, { role: "owner" }, { status: "deleted" }, { query: "a".repeat(161) }, { password: "fixture" }]) assert.equal(cmsUserListQuerySchema.safeParse(invalid).success, false);
});

const base = { username: "editor-test", email: null, fullName: "Người biên tập", role: "editor", status: "active", password: null };
const id = "11111111-1111-4111-8111-111111111111";
test("tạo tài khoản cần mật khẩu, sửa được giữ mật khẩu hiện tại", () => {
  assert.equal(cmsUserRequestSchema.safeParse({ id: null, values: base }).success, false);
  assert.equal(cmsUserRequestSchema.safeParse({ id, values: base }).success, true);
});
test("chuẩn hóa text lúc submit nhưng giữ nguyên mật khẩu và dữ liệu nguồn", () => {
  const password = "  fixture-password  ";
  const input = { id: null, values: { ...base, username: " editor-test ", fullName: " Người biên tập  ", password } };
  const result = cmsUserRequestSchema.parse(input);
  assert.equal(result.values.username, "editor-test");
  assert.equal(result.values.fullName, "Người biên tập");
  assert.equal(result.values.password, password);
  assert.equal(input.values.fullName, " Người biên tập  ");
});
test("từ chối role/status lạ, email sai và thuộc tính không được phép", () => {
  for (const change of [{ role: "owner" }, { status: "deleted" }, { email: "invalid" }, { password: "short" }, { passwordHash: "unexpected" }]) {
    assert.equal(cmsUserRequestSchema.safeParse({ id, values: { ...base, ...change } }).success, false);
  }
});
