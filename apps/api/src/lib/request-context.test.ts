import assert from "node:assert/strict";
import test from "node:test";

import { logger, setErrorLogSink } from "@iorder/shared/server/shared/logger";
import { currentRequestContext } from "@iorder/shared/server/shared/request-context";

import { withRequestContext } from "./request-context";

test("Route bọc withRequestContext thấy IP, thiết bị, mã request; ngoài request thì không", async () => {
  const handler = withRequestContext(async (request: Request) => {
    assert.ok(request.headers.get("x-request-id"));
    await new Promise(resolve => setTimeout(resolve, 5));
    return currentRequestContext();
  });
  const request = (ip: string, id: string) => new Request("http://backend/api/v1/admin/pages", { headers: { "x-forwarded-for": ip, "user-agent": "Mozilla/5.0 Test", "x-request-id": id } });
  // Hai request chạy song song không được lẫn ngữ cảnh của nhau.
  const [first, second] = await Promise.all([handler(request("203.0.113.7", "req-aaaaaaaa")), handler(request("198.51.100.9", "req-bbbbbbbb"))]);
  assert.deepEqual(first, { ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0 Test", requestId: "req-aaaaaaaa" });
  assert.deepEqual(second, { ipAddress: "198.51.100.9", userAgent: "Mozilla/5.0 Test", requestId: "req-bbbbbbbb" });
  assert.equal(currentRequestContext(), undefined);
});

// Lưới an toàn của Nhật ký lỗi: route trả 5xx mà không tự gọi logger.error thì withRequestContext ghi một dòng; route đã ghi thì không ghi trùng.
test("Route trả 5xx mà không ghi log được ghi một dòng lỗi; route đã ghi log thì không bị ghi trùng; 4xx và 2xx bị bỏ qua", async () => {
  const received: Array<Record<string, unknown>> = [];
  const originalError = console.error;
  console.error = () => undefined;
  setErrorLogSink((entry) => { received.push(entry); });
  try {
    const fail = (status: number) => Response.json({ error: { code: status >= 500 ? "INTERNAL_ERROR" : "INVALID_INPUT", message: "Không thể lưu biểu mẫu tư vấn lúc này." } }, { status });
    const request = () => new Request("http://backend/api/v1/admin/consult-form", { method: "PUT", headers: { "x-request-id": "req-safety-net" } });
    const reply = (make: () => Response) => withRequestContext(async (current: Request) => { void current; return make(); });
    const silent = reply(() => fail(500));
    const loud = withRequestContext(async (current: Request) => { logger.error("Route tự ghi.", { request: current, error: new Error("chi tiết") }); return fail(500); });
    const clientError = reply(() => fail(400));
    const ok = reply(() => Response.json({ ok: true }));

    const response = await silent(request());
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: { code: "INTERNAL_ERROR", message: "Không thể lưu biểu mẫu tư vấn lúc này." } });
    assert.equal(received.length, 1);
    assert.equal(received[0]?.msg, "Route trả lỗi máy chủ nhưng không ghi chi tiết.");
    assert.equal(received[0]?.path, "/api/v1/admin/consult-form");
    assert.equal(received[0]?.requestId, "req-safety-net");
    assert.equal(received[0]?.errorCode, "INTERNAL_ERROR");
    assert.equal(received[0]?.errorMessage, "Không thể lưu biểu mẫu tư vấn lúc này.");

    await loud(request());
    assert.deepEqual(received.map((entry) => entry.msg), ["Route trả lỗi máy chủ nhưng không ghi chi tiết.", "Route tự ghi."]);
    await clientError(request());
    await ok(request());
    assert.equal(received.length, 2);
  } finally {
    setErrorLogSink(undefined);
    console.error = originalError;
  }
});
