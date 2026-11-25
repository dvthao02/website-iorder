import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { NextRequest } from "next/server";
import { serverOriginSecretHeader } from "@iorder/shared/server/publishing/cache-invalidation";

import { proxy } from "./proxy";
import { apiRateLimiter } from "./lib/rate-limit-policy";

const request = (path: string, init: { method?: string; ip?: string; headers?: Record<string, string> } = {}) => new NextRequest(`https://cms.example${path}`, {
  method: init.method ?? "GET",
  headers: { ...(init.ip ? { "x-forwarded-for": init.ip } : {}), ...init.headers },
});

beforeEach(() => apiRateLimiter.clear());
afterEach(() => {
  delete process.env.PUBLISH_WEB_REVALIDATE_SECRET;
  delete process.env.RATE_LIMIT_DISABLED;
  apiRateLimiter.clear();
});

test("Gửi liên hệ dồn dập từ một IP bị chặn 429 kèm Retry-After, IP khác vẫn qua", async () => {
  for (let i = 0; i < 20; i += 1) assert.equal((await proxy(request("/api/v1/leads", { method: "POST", ip: "203.0.113.10" }))).status, 200);

  const blocked = await proxy(request("/api/v1/leads", { method: "POST", ip: "203.0.113.10" }));
  assert.equal(blocked.status, 429);
  assert.match(blocked.headers.get("retry-after") ?? "", /^[1-9]\d*$/);
  assert.match(blocked.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
  const body = await blocked.json() as { error: { code: string; message: string } };
  assert.equal(body.error.code, "RATE_LIMITED");
  assert.match(body.error.message, /quá nhanh/);

  assert.equal((await proxy(request("/api/v1/leads", { method: "POST", ip: "203.0.113.11" }))).status, 200);
});

test("Request không có IP không bị giới hạn", async () => {
  for (let i = 0; i < 40; i += 1) assert.equal((await proxy(request("/api/v1/leads", { method: "POST" }))).status, 200);
});

// Next tự gán X-Forwarded-For = địa chỉ socket cho request thiếu header đó, nên lời gọi server-side của website/CMS tới Backend KHÔNG thiếu IP:
// chúng mang IP của container (mạng riêng) hoặc loopback khi chạy local. Từng bị đếm chung thành một khách và làm trang website trả 500.
test("Lời gọi nội bộ (IP loopback/mạng riêng/Docker do Next gán) không bao giờ bị giới hạn", async () => {
  for (const ip of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "172.18.0.5", "10.0.0.3", "192.168.1.9"]) {
    for (let i = 0; i < 130; i += 1) assert.equal((await proxy(request("/api/v1/public/content", { ip }))).status, 200, `${ip} lần ${i + 1}`);
  }
});

test("IP công cộng giống hệt kịch bản trên vẫn bị giới hạn", async () => {
  for (let i = 0; i < 120; i += 1) assert.equal((await proxy(request("/api/v1/public/content", { ip: "203.0.113.80" }))).status, 200);
  assert.equal((await proxy(request("/api/v1/public/content", { ip: "203.0.113.80" }))).status, 429);
});

test("Worker có secret hợp lệ đọc public API không bị gom chung hạn mức theo IP Cloudflare", async () => {
  const secret = "secret-noi-bo-giua-worker-va-backend";
  process.env.PUBLISH_WEB_REVALIDATE_SECRET = secret;
  const init = { ip: "2a06:98c0:3600::103", headers: { [serverOriginSecretHeader]: secret } };

  for (let i = 0; i < 130; i += 1) {
    assert.equal((await proxy(request("/api/v1/public/content", init))).status, 200, `lần ${i + 1}`);
  }
});

test("Secret sai không bỏ qua hạn mức và secret đúng không bỏ qua API ghi", async () => {
  const secret = "secret-noi-bo-giua-worker-va-backend";
  process.env.PUBLISH_WEB_REVALIDATE_SECRET = secret;

  const wrong = { ip: "203.0.113.81", headers: { [serverOriginSecretHeader]: "secret-sai" } };
  for (let i = 0; i < 120; i += 1) assert.equal((await proxy(request("/api/v1/public/content", wrong))).status, 200);
  assert.equal((await proxy(request("/api/v1/public/content", wrong))).status, 429);

  const write = { method: "POST", ip: "203.0.113.82", headers: { [serverOriginSecretHeader]: secret } };
  for (let i = 0; i < 20; i += 1) assert.equal((await proxy(request("/api/v1/leads", write))).status, 200);
  assert.equal((await proxy(request("/api/v1/leads", write))).status, 429);
});

test("Chặn trước khi kiểm phiên: API admin bị dồn dập trả 429 thay vì truy vấn DB", async () => {
  // Không cookie nên 600 request đầu qua giới hạn rồi trả 401 (không cần DB); request thứ 601 phải bị chặn 429 ngay ở bước đếm.
  for (let i = 0; i < 600; i += 1) assert.equal((await proxy(request("/api/v1/admin/pages", { ip: "203.0.113.20" }))).status, 401);
  assert.equal((await proxy(request("/api/v1/admin/pages", { ip: "203.0.113.20" }))).status, 429);
});

test("Nhóm khác nhau đếm riêng cho cùng một IP", async () => {
  for (let i = 0; i < 21; i += 1) await proxy(request("/api/v1/leads", { method: "POST", ip: "203.0.113.30" }));
  assert.equal((await proxy(request("/api/v1/leads", { method: "POST", ip: "203.0.113.30" }))).status, 429);
  assert.equal((await proxy(request("/api/v1/admin/session", { ip: "203.0.113.30" }))).status, 200);
});

test("Form đăng nhập của trình duyệt bị chặn thì quay về trang đăng nhập kèm mã RATE_LIMITED", async () => {
  const form = { method: "POST", ip: "203.0.113.40", headers: { "content-type": "application/x-www-form-urlencoded" } };
  for (let i = 0; i < 20; i += 1) assert.equal((await proxy(request("/api/v1/admin/session", form))).status, 200);

  const blocked = await proxy(request("/api/v1/admin/session", form));
  assert.equal(blocked.status, 303);
  assert.equal(blocked.headers.get("location"), "/admin/login?error=RATE_LIMITED");
  assert.match(blocked.headers.get("retry-after") ?? "", /^[1-9]\d*$/);

  const api = await proxy(request("/api/v1/admin/session", { method: "POST", ip: "203.0.113.40", headers: { "content-type": "application/json" } }));
  assert.equal(api.status, 429);
});

test("Health check không bao giờ bị giới hạn", async () => {
  for (let i = 0; i < 400; i += 1) assert.equal((await proxy(request("/api/health", { ip: "203.0.113.50" }))).status, 200);
});

test("RATE_LIMIT_DISABLED=1 tắt giới hạn", async () => {
  process.env.RATE_LIMIT_DISABLED = "1";
  for (let i = 0; i < 40; i += 1) assert.equal((await proxy(request("/api/v1/leads", { method: "POST", ip: "203.0.113.60" }))).status, 200);
});

test("X-Forwarded-For nhiều phần tử: lấy IP ngoài cùng bên phải (Caddy ghi), không tin phần client tự thêm", async () => {
  for (let i = 0; i < 20; i += 1) await proxy(request("/api/v1/leads", { method: "POST", ip: `198.51.100.${i}, 203.0.113.70` }));
  assert.equal((await proxy(request("/api/v1/leads", { method: "POST", ip: "198.51.100.99, 203.0.113.70" }))).status, 429);
});
