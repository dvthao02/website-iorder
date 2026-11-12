import assert from "node:assert/strict";
import test from "node:test";
import { buildLogEntry, normalizeRequestId, resolveRequestId, sanitizeLogValue, serializeError } from "./logger";

test("chỉ nhận request id có dạng an toàn", () => {
  assert.equal(normalizeRequestId("3f2b9c1e-1111-4a2b-9c3d-123456789abc"), "3f2b9c1e-1111-4a2b-9c3d-123456789abc");
  for (const value of [null, "", "short", "has space here", "x".repeat(200), "a\nb-injected-line"]) assert.equal(normalizeRequestId(value), null);
  const generated = resolveRequestId(new Headers({ "x-request-id": "bad id" }));
  assert.match(generated, /^[0-9a-f-]{36}$/);
});

test("che giá trị của khóa nhạy cảm ở mọi cấp", () => {
  const value = sanitizeLogValue({ username: "a", password: "x", nested: { apiKey: "k", sessionId: "s", ok: 1 }, list: [{ token: "t" }] });
  assert.deepEqual(value, { username: "a", password: "[ẩn]", nested: { apiKey: "[ẩn]", sessionId: "[ẩn]", ok: 1 }, list: [{ token: "[ẩn]" }] });
});

test("không ghi tham số SQL và giữ thông tin lỗi Postgres", () => {
  const cause = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint_name: "users_username_unique", detail: "Key (username)=(an) already exists." });
  const error = new Error("Failed query: insert into users (username, password_hash) values ($1, $2)\nparams: an,$argon2id$secret", { cause });
  const serialized = serializeError(error);
  assert.equal(serialized.message, "Failed query: insert into users (username, password_hash) values ($1, $2)\nparams: [ẩn]");
  assert.ok(!JSON.stringify(serialized).includes("argon2id"));
  assert.deepEqual({ ...(serialized.cause as Record<string, unknown>), stack: undefined }, { name: "Error", message: "duplicate key value violates unique constraint", code: "23505", constraint_name: "users_username_unique", stack: undefined });
  assert.ok(!JSON.stringify(serialized).includes("already exists"));
});

test("dòng log có requestId, method, path không kèm query string", () => {
  const request = { headers: new Headers({ "x-request-id": "req-12345678" }), method: "GET", url: "http://backend/api/admin/leads?query=0901234567" };
  const entry = buildLogEntry("error", "Tải thất bại.", { request, error: new Error("boom"), userId: "u1" }, "backend");
  assert.equal(entry.service, "backend");
  assert.equal(entry.requestId, "req-12345678");
  assert.equal(entry.path, "/api/admin/leads");
  assert.equal(entry.userId, "u1");
  assert.equal((entry.err as { message: string }).message, "boom");
  assert.ok(!JSON.stringify(entry).includes("0901234567"));
});
