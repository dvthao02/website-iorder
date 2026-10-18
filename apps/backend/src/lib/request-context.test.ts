import assert from "node:assert/strict";
import test from "node:test";

import { currentRequestContext } from "@iorder/core/server/shared/request-context";

import { withRequestContext } from "./request-context";

test("Route bọc withRequestContext thấy IP, thiết bị, mã request; ngoài request thì không", async () => {
  const handler = withRequestContext(async (request: Request) => {
    assert.ok(request.headers.get("x-request-id"));
    await new Promise(resolve => setTimeout(resolve, 5));
    return currentRequestContext();
  });
  const request = (ip: string, id: string) => new Request("http://backend/api/admin/pages", { headers: { "x-forwarded-for": ip, "user-agent": "Mozilla/5.0 Test", "x-request-id": id } });
  // Hai request chạy song song không được lẫn ngữ cảnh của nhau.
  const [first, second] = await Promise.all([handler(request("203.0.113.7", "req-aaaaaaaa")), handler(request("198.51.100.9", "req-bbbbbbbb"))]);
  assert.deepEqual(first, { ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0 Test", requestId: "req-aaaaaaaa" });
  assert.deepEqual(second, { ipAddress: "198.51.100.9", userAgent: "Mozilla/5.0 Test", requestId: "req-bbbbbbbb" });
  assert.equal(currentRequestContext(), undefined);
});
