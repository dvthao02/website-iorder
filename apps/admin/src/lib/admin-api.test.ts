import assert from "node:assert/strict";
import test from "node:test";

import { adminApiError, apiErrorMessage } from "./admin-api";

test("apiErrorMessage đọc message chuẩn của backend", () => {
  assert.equal(apiErrorMessage({ error: { code: "CONFLICT", message: "Dữ liệu đã thay đổi." } }, "Dự phòng"), "Dữ liệu đã thay đổi.");
});

test("apiErrorMessage dùng thông báo dự phòng khi payload không đúng dạng", () => {
  for (const payload of [null, undefined, "<html>", {}, { error: null }, { error: { message: 42 } }, { error: { message: "" } }]) {
    assert.equal(apiErrorMessage(payload, "Dự phòng"), "Dự phòng");
  }
});

test("adminApiError giữ mã lỗi để màn hình nhận ra xung đột phiên bản", () => {
  const error = adminApiError({ error: { code: "VERSION_CONFLICT", message: "Nội dung đã được người khác cập nhật." } }, "Dự phòng");
  assert.equal(error.code, "VERSION_CONFLICT");
  assert.equal(error.message, "Nội dung đã được người khác cập nhật.");
  assert.equal(adminApiError("<html>", "Dự phòng").code, undefined);
});

test("readAdminJson: trang lỗi dạng chữ không làm văng lỗi JSON kỹ thuật", async () => {
  const { readAdminJson, adminApiError, upstreamUnavailableMessage } = await import("./admin-api");
  const proxyError = await readAdminJson(new Response("Internal Server Error", { status: 500 }));
  assert.equal(adminApiError(proxyError, "Không thể lưu trang.").message, upstreamUnavailableMessage);
  assert.equal(await readAdminJson(new Response("<html>", { status: 404 })), null);
  assert.equal(adminApiError(await readAdminJson(new Response("", { status: 404 })), "Không thể lưu trang.").message, "Không thể lưu trang.");
  assert.deepEqual(await readAdminJson(Response.json({ page: { id: "a" } })), { page: { id: "a" } });
  assert.equal(adminApiError(await readAdminJson(Response.json({ error: { code: "X", message: "Lỗi cụ thể" } }, { status: 500 })), "fallback").message, "Lỗi cụ thể");
});

test("requestAdminJson gửi đúng method/thân và trả về JSON; không có thân thì không đặt content-type", async () => {
  const { requestAdminJson } = await import("./admin-api");
  const calls: { url: string; init: RequestInit }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return Response.json({ ok: true }); }) as typeof fetch;
  try {
    assert.deepEqual(await requestAdminJson("/api/x", "DELETE", { id: "1" }, "lỗi"), { ok: true });
    assert.deepEqual(await requestAdminJson("/api/x", "GET", undefined, "lỗi", { cache: "no-store" }), { ok: true });
  } finally { globalThis.fetch = original; }
  assert.equal(calls[0]!.init.method, "DELETE");
  assert.equal(calls[0]!.init.body, JSON.stringify({ id: "1" }));
  assert.deepEqual(calls[0]!.init.headers, { accept: "application/json", "content-type": "application/json" });
  assert.equal(calls[1]!.init.method, "GET");
  assert.equal(calls[1]!.init.body, undefined);
  assert.equal(calls[1]!.init.cache, "no-store");
  assert.deepEqual(calls[1]!.init.headers, { accept: "application/json" });
});

test("requestAdminJson ném AdminApiError có mã, trạng thái HTTP và phần error nguyên văn; 5xx dạng chữ dùng thông báo chuẩn", async () => {
  const { AdminApiError, requestAdminJson, upstreamUnavailableMessage } = await import("./admin-api");
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () => Response.json({ error: { code: "INVALID_SECRET", message: "Giá trị sai", key: "UMAMI_URL" } }, { status: 422 })) as typeof fetch;
    await assert.rejects(requestAdminJson("/api/x", "PUT", {}, "dự phòng"), (error: unknown) => {
      assert.ok(error instanceof AdminApiError);
      assert.deepEqual([error.message, error.code, error.status, error.details?.key], ["Giá trị sai", "INVALID_SECRET", 422, "UMAMI_URL"]);
      return true;
    });
    globalThis.fetch = (async () => new Response("Internal Server Error", { status: 502 })) as typeof fetch;
    await assert.rejects(requestAdminJson("/api/x", "GET", undefined, "dự phòng"), (error: unknown) => error instanceof AdminApiError && error.message === upstreamUnavailableMessage && error.status === 502);
    globalThis.fetch = (async () => new Response("<html>", { status: 404 })) as typeof fetch;
    await assert.rejects(requestAdminJson("/api/x", "GET", undefined, "Không tìm thấy."), (error: unknown) => error instanceof AdminApiError && error.message === "Không tìm thấy." && error.details === undefined);
  } finally { globalThis.fetch = original; }
});

test("requestAdmin gửi được FormData (tải tệp lên) mà không ép content-type", async () => {
  const { requestAdmin } = await import("./admin-api");
  let seen: RequestInit | undefined;
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => { seen = init; return Response.json({ asset: { id: "a" } }); }) as typeof fetch;
  try {
    const body = new FormData(); body.set("file", new Blob(["x"]), "a.txt");
    assert.deepEqual(await requestAdmin("/api/upload", { method: "POST", body }, "lỗi"), { asset: { id: "a" } });
  } finally { globalThis.fetch = original; }
  assert.ok(seen!.body instanceof FormData);
  assert.deepEqual(seen!.headers, { accept: "application/json" });
});
