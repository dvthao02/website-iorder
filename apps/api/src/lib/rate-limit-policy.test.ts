import assert from "node:assert/strict";
import test from "node:test";

import { isRateLimitDisabled, rateLimitFor } from "./rate-limit-policy";

const group = (path: string, method = "GET") => rateLimitFor(path, method)?.group ?? null;

test("Nhóm hạn mức theo đường dẫn và phương thức", () => {
  assert.equal(group("/api/v1/leads", "POST"), "lead");
  assert.equal(group("/api/v1/admin/session", "POST"), "login");
  assert.equal(group("/api/v1/admin/session", "GET"), "admin-read");
  assert.equal(group("/api/v1/admin/session", "DELETE"), "admin-write");
  assert.equal(group("/api/v1/admin/account/password", "POST"), "sensitive");
  assert.equal(group("/api/v1/admin/account/avatar", "DELETE"), "sensitive");
  assert.equal(group("/api/v1/admin/secrets", "PUT"), "sensitive");
  assert.equal(group("/api/v1/admin/backup", "POST"), "sensitive");
  assert.equal(group("/api/v1/admin/audit", "POST"), "sensitive");
  assert.equal(group("/api/v1/admin/audit", "GET"), "admin-read");
  assert.equal(group("/api/v1/admin/backup", "GET"), "admin-read");
  assert.equal(group("/api/v1/admin/media", "POST"), "upload");
  assert.equal(group("/api/v1/admin/media", "GET"), "admin-read");
  assert.equal(group("/api/v1/admin/media/11111111-1111-4111-8111-111111111111", "PATCH"), "admin-write");
  assert.equal(group("/api/v1/admin/media/import-url", "POST"), "heavy");
  assert.equal(group("/api/v1/admin/posts/abc/word", "POST"), "heavy");
  assert.equal(group("/api/v1/admin/data-transfer/leads", "GET"), "heavy");
  assert.equal(group("/api/v1/admin/leads/export", "GET"), "heavy");
  assert.equal(group("/api/v1/admin/seo-audit", "GET"), "heavy");
  assert.equal(group("/api/v1/admin/pages", "PATCH"), "admin-write");
  assert.equal(group("/api/v1/admin/pages", "GET"), "admin-read");
  assert.equal(group("/api/v1/public/content", "GET"), "public");
  assert.equal(group("/media/uploads/a.png", "GET"), "media");
  assert.equal(group("/api/v1/khong-ton-tai", "GET"), "api");
});

test("Health check không bị giới hạn", () => {
  assert.equal(rateLimitFor("/api/health", "GET"), null);
});

test("Gạch chéo thừa không né được nhóm nặng", () => {
  assert.equal(group("/api/v1/admin/media/import-url/", "POST"), "heavy");
  assert.equal(group("/api/v1//admin//data-transfer//leads", "GET"), "heavy");
});

test("Nhóm bảo vệ đặt chặt hơn nhóm đọc thông thường", () => {
  const limit = (path: string, method: string) => rateLimitFor(path, method)!.limit;
  assert.ok(limit("/api/v1/admin/session", "POST") < limit("/api/v1/admin/pages", "PATCH"));
  assert.ok(limit("/api/v1/admin/media/import-url", "POST") < limit("/api/v1/admin/media", "POST"));
  assert.ok(limit("/api/v1/admin/media", "POST") < limit("/api/v1/admin/pages", "PATCH"));
  assert.ok(limit("/api/v1/admin/pages", "PATCH") < limit("/api/v1/admin/pages", "GET"));
});

test("Công tắc khẩn cấp RATE_LIMIT_DISABLED", () => {
  assert.equal(isRateLimitDisabled({}), false);
  assert.equal(isRateLimitDisabled({ RATE_LIMIT_DISABLED: "" }), false);
  assert.equal(isRateLimitDisabled({ RATE_LIMIT_DISABLED: "0" }), false);
  assert.equal(isRateLimitDisabled({ RATE_LIMIT_DISABLED: "1" }), true);
  assert.equal(isRateLimitDisabled({ RATE_LIMIT_DISABLED: " TRUE " }), true);
});
