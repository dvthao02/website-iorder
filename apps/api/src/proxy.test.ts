import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { proxy } from "./proxy";

test("Proxy yêu cầu phiên đăng nhập cho API admin", async () => {
  const getResponse = await proxy(new NextRequest("https://cms.example/api/admin/pages"));
  const mutationResponse = await proxy(new NextRequest("http://backend:3000/api/admin/pages", {
    method: "POST",
    headers: { origin: "https://cms.example", "x-forwarded-host": "cms.example" },
  }));

  assert.equal(getResponse.status, 401);
  assert.equal(mutationResponse.status, 401);
});

test("Proxy chặn Origin khác host cho toàn bộ mutation admin", async () => {
  const response = await proxy(new NextRequest("https://cms.example/api/admin/pages", {
    method: "PATCH",
    headers: { origin: "https://khac.example" },
  }));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: { code: "FORBIDDEN", message: "Nguồn gửi yêu cầu không hợp lệ." },
  });
});

test("Proxy giữ tương thích cho client không gửi Origin khi đăng nhập", async () => {
  const response = await proxy(new NextRequest("https://cms.example/api/admin/session", { method: "POST" }));

  assert.equal(response.status, 200);
});

test("Proxy gắn mã request cho mọi phản hồi, giữ mã hợp lệ và thay mã lạ", async () => {
  const kept = await proxy(new NextRequest("https://cms.example/api/admin/pages", { headers: { "x-request-id": "3f2b9c1e-1111-4a2b-9c3d-123456789abc" } }));
  assert.equal(kept.status, 401);
  assert.equal(kept.headers.get("x-request-id"), "3f2b9c1e-1111-4a2b-9c3d-123456789abc");

  const replaced = await proxy(new NextRequest("https://cms.example/api/admin/pages", { headers: { "x-request-id": "bad id <script>" } }));
  assert.match(replaced.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
});

test("Proxy không kiểm tra quyền hay Origin cho API public nhưng vẫn gắn mã request", async () => {
  const response = await proxy(new NextRequest("https://example.com/api/public/leads", { method: "POST", headers: { origin: "https://khac.example" } }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(response.headers.get("x-middleware-request-x-request-id"), response.headers.get("x-request-id"));
});
