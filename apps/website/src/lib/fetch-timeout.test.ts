import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { installDefaultFetchTimeout, withDefaultFetchTimeout } from "./fetch-timeout";

type Call = { input: Parameters<typeof fetch>[0]; init?: Parameters<typeof fetch>[1] };

function recordingFetch() {
  const calls: Call[] = [];
  const base = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => { calls.push({ input, init }); return new Response("ok"); }) as typeof fetch;
  return { base, calls };
}

test("Fetch không có signal được gắn timeout và giữ nguyên các tùy chọn khác", async () => {
  const { base, calls } = recordingFetch();
  await withDefaultFetchTimeout(base, 5_000)("http://backend/x", { method: "POST", headers: { a: "1" }, cache: "no-store" });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].init?.signal instanceof AbortSignal);
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(calls[0].init?.headers, { a: "1" });
  assert.equal(calls[0].init?.cache, "no-store");
});

test("Lượt làm mới nền của Next (signal bị đặt thành undefined) cũng được gắn timeout", async () => {
  const { base, calls } = recordingFetch();
  await withDefaultFetchTimeout(base)("http://backend/x", { signal: undefined, next: { fetchType: "origin" } } as RequestInit);
  assert.ok(calls[0].init?.signal instanceof AbortSignal);
});

test("Fetch không có tùy chọn nào vẫn có signal", async () => {
  const { base, calls } = recordingFetch();
  await withDefaultFetchTimeout(base)("http://backend/x");
  assert.ok(calls[0].init?.signal instanceof AbortSignal);
});

test("Signal do nơi gọi truyền vào được giữ nguyên", async () => {
  const { base, calls } = recordingFetch();
  const signal = AbortSignal.timeout(2_000);
  await withDefaultFetchTimeout(base)("http://backend/x", { signal });
  assert.equal(calls[0].init?.signal, signal);
});

test("Request tự có signal nên không bị đổi", async () => {
  const { base, calls } = recordingFetch();
  const request = new Request("http://backend/x");
  await withDefaultFetchTimeout(base)(request);
  assert.equal(calls[0].input, request);
  assert.equal(calls[0].init, undefined);
});

test("Backend không trả header thì fetch báo TimeoutError đúng hạn thay vì đợi 5 phút", async () => {
  const server = createServer(() => { /* không bao giờ trả lời */ });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const bounded = withDefaultFetchTimeout(fetch, 200);
    const startedAt = Date.now();
    await assert.rejects(bounded(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`), (error: unknown) => (error as Error).name === "TimeoutError");
    assert.ok(Date.now() - startedAt < 3_000);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("installDefaultFetchTimeout chỉ bọc fetch toàn cục một lần", async () => {
  const original = globalThis.fetch;
  try {
    installDefaultFetchTimeout(5_000);
    const first = globalThis.fetch;
    assert.notEqual(first, original);
    installDefaultFetchTimeout(5_000);
    assert.equal(globalThis.fetch, first);
  } finally {
    globalThis.fetch = original;
  }
});
