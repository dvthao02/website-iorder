import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { resetLeadToken, submitLead } from "./submit-lead";

type Call = { method: string; body: Record<string, unknown> | null };
const realFetch = globalThis.fetch;
let calls: Call[] = [];
let tokens: string[] = [];
let postResponses: Array<{ status: number; body: unknown }> = [];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  calls = []; tokens = ["tok-1", "tok-2", "tok-3"]; postResponses = [];
  resetLeadToken();
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, body: typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : null });
    if (method === "GET") { const token = tokens.shift(); return token ? json(200, { token }) : json(500, {}); }
    const next = postResponses.shift() ?? { status: 201, body: { message: "Cảm ơn bạn." } };
    return json(next.status, next.body);
  }) as typeof fetch;
});
afterEach(() => { mock.timers.reset(); globalThis.fetch = realFetch; });

// Chạy submitLead cho tới khi xong: mỗi vòng cho các lời gọi fetch giả hoàn tất rồi tua đồng hồ qua thời gian chờ mã đủ tuổi.
async function run(promise: ReturnType<typeof submitLead>) {
  let finished = false;
  void promise.finally(() => { finished = true; });
  for (let step = 0; step < 12 && !finished; step += 1) {
    await new Promise<void>((resolve) => { setImmediate(resolve); });
    mock.timers.tick(2_500);
  }
  return promise;
}

test("Gửi liên hệ: xin mã phiên, chờ mã đủ tuổi rồi gửi kèm mã", async () => {
  const result = await run(submitLead({ name: "Nguyễn Văn A", phone: "0912345678" }));
  assert.deepEqual(result, { ok: true, message: "Cảm ơn bạn." });
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST"]);
  assert.equal(calls[1].body?.token, "tok-1");
  assert.equal(calls[1].body?.name, "Nguyễn Văn A");
});

test("Gửi liên hệ: mã đã có được dùng lại cho lần gửi sau, không xin thêm", async () => {
  await run(submitLead({ name: "A B", phone: "0912345678" }));
  await run(submitLead({ name: "C D", phone: "0912345679" }));
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "POST"]);
  assert.equal(calls[2].body?.token, "tok-1");
});

test("Gửi liên hệ: Backend báo mã sai hoặc gửi quá nhanh thì xin mã mới và gửi lại đúng một lần", async () => {
  postResponses = [{ status: 400, body: { error: { code: "LEAD_TOKEN_INVALID", message: "Phiên gửi đã hết hạn." } } }];
  const result = await run(submitLead({ name: "A B", phone: "0912345678" }));
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "GET", "POST"]);
  assert.deepEqual([calls[1].body?.token, calls[3].body?.token], ["tok-1", "tok-2"]);

  // Lần thứ hai vẫn bị từ chối thì dừng, báo đúng lời của Backend (không lặp vô hạn).
  calls = []; resetLeadToken(); tokens = ["a", "b", "c"];
  postResponses = [{ status: 429, body: { error: { code: "LEAD_TOO_FAST", message: "Bạn gửi hơi nhanh." } } }, { status: 429, body: { error: { code: "LEAD_TOO_FAST", message: "Bạn gửi hơi nhanh." } } }];
  const failed = await run(submitLead({ name: "A B", phone: "0912345678" }));
  assert.deepEqual(failed, { ok: false, message: "Bạn gửi hơi nhanh." });
  assert.equal(calls.filter((call) => call.method === "POST").length, 2);
});

test("Gửi liên hệ: lỗi khác (giới hạn tần suất, dữ liệu sai) không gửi lại và giữ nguyên lời của Backend", async () => {
  postResponses = [{ status: 429, body: { error: { code: "RATE_LIMITED", message: "Thử lại sau 14 phút." } } }];
  assert.deepEqual(await run(submitLead({ name: "A B", phone: "0912345678" })), { ok: false, message: "Thử lại sau 14 phút." });
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  resetLeadToken(); tokens = ["x"];
  postResponses = [{ status: 400, body: {} }];
  assert.deepEqual(await run(submitLead({ name: "A B", phone: "0912345678" })), { ok: false, message: "Không thể gửi liên hệ. Vui lòng thử lại sau." });
});

test("Gửi liên hệ: không xin được mã thì vẫn gửi (Backend quyết định), mất kết nối thì báo lỗi mạng", async () => {
  tokens = [];
  const result = await run(submitLead({ name: "A B", phone: "0912345678" }));
  assert.equal(result.ok, true);
  assert.equal(calls[1].body && "token" in calls[1].body, false);
  globalThis.fetch = (async () => { throw new TypeError("network"); }) as typeof fetch;
  resetLeadToken();
  assert.deepEqual(await run(submitLead({ name: "A B", phone: "0912345678" })), { ok: false, message: "Không kết nối được máy chủ. Vui lòng thử lại sau." });
});
