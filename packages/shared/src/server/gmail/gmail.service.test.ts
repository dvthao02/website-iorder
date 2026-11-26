import assert from "node:assert/strict";
import test from "node:test";

import { ZodError } from "zod";

import type { SecretKey } from "../secrets/secrets.contract";
import { googleTokenUrl } from "../search-console/google-auth";
import { ContentVersionConflictError } from "../shared/content-version";
import { defaultGmailSettings, gmailCallbackPath, type GmailConnection, type GmailSettings } from "./gmail.contract";
import { gmailSendScope, gmailSendUrl, googleRevokeUrl } from "./gmail.google";
import { createPendingConnections } from "./gmail.pending";
import type { ConnectionPatch, GmailRepository } from "./gmail.repository";
import { createGmailService, GmailError, type GmailDependencies } from "./gmail.service";

const redirectUri = `https://cms.iorder.example${gmailCallbackPath}`;
const idToken = (email: string) => ["h", Buffer.from(JSON.stringify({ email, email_verified: true })).toString("base64url"), "s"].join(".");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Call = { url: string; form: Record<string, string>; json?: { raw?: string }; authorization?: string };

function setup(options: { connection?: GmailConnection | null; settings?: Partial<GmailSettings>; secrets?: Partial<Record<SecretKey, string>>; env?: Record<string, string>; passwordOk?: boolean; respond?: (call: Call) => Response | undefined } = {}) {
  const clock = { time: Date.parse("2026-11-26T03:00:00Z") };
  const store = {
    settings: { ...defaultGmailSettings, ...options.settings } as GmailSettings, version: 3,
    connection: options.connection === undefined ? null : options.connection,
    secrets: { google_oauth_client_id: "cid.apps.googleusercontent.com", google_oauth_client_secret: "csecret-123", ...options.secrets } as Partial<Record<SecretKey, string>>,
    audit: [] as string[],
  };
  const calls: Call[] = [];
  const fetchFn = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const call: Call = { url, form: init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : {}, authorization: (init.headers as Record<string, string> | undefined)?.authorization };
    if (url === gmailSendUrl) call.json = JSON.parse(String(init.body)) as { raw?: string };
    calls.push(call);
    const custom = options.respond?.(call);
    if (custom) return custom;
    if (url === googleTokenUrl) {
      if (call.form.grant_type === "authorization_code") return json({ access_token: "at", refresh_token: "refresh-token-0123456789", scope: `openid email ${gmailSendScope}`, id_token: idToken("chu.so.huu@gmail.com") });
      return json({ access_token: `at-${calls.length}`, expires_in: 3600 });
    }
    if (url === gmailSendUrl) return json({ id: "m1" });
    return json({});
  }) as typeof fetch;
  const repository: GmailRepository = {
    async readSettings() { return { settings: store.settings, version: store.version }; },
    async writeSettings(values, _userId, expectedVersion) {
      if (expectedVersion !== store.version) throw new ContentVersionConflictError();
      store.settings = values; store.version += 1; return store.version;
    },
    async readConnection() { return store.connection; },
    async saveConnection(connection) { store.connection = connection; store.audit.push("connect"); },
    async patchConnection(patch: ConnectionPatch) { if (store.connection) store.connection = { ...store.connection, ...patch }; },
    async removeConnection() { store.connection = null; store.audit.push("disconnect"); },
    async recordTestSend() { store.audit.push("test"); },
  };
  const logs: string[] = [];
  const deps: GmailDependencies = {
    repository,
    secrets: {
      async get(key) { return store.secrets[key]; },
      async put({ key, value }) { store.secrets[key] = value; },
      async remove({ key }) { delete store.secrets[key]; },
      async verifyPassword() { if (options.passwordOk === false) throw new Error("INVALID_PASSWORD"); },
    },
    env: options.env ?? {}, fetch: fetchFn, now: () => new Date(clock.time), log: (message) => { logs.push(message); },
    pending: createPendingConnections({ now: () => clock.time }),
  };
  return { service: createGmailService(deps), store, calls, clock, logs };
}

const connected = (patch: Partial<GmailConnection> = {}): GmailConnection => ({ email: "chu.so.huu@gmail.com", status: "connected", connectedAt: "2026-11-25T10:00:00.000Z", cmsOrigin: "https://cms.iorder.example", lastSentAt: null, lastError: null, lastErrorAt: null, ...patch });
const lead = { id: "6f1c2a52-8a7e-4b8e-9c0d-3f2b1a4d5e60", name: "Nguyễn Văn A", phone: "0901234567", message: "Cần báo giá", createdAt: new Date("2026-11-26T03:00:00Z") };
const sentMime = (call: Call) => Buffer.from(call.json?.raw ?? "", "base64url").toString("utf8");
const stateOf = (authUrl: string) => new URL(authUrl).searchParams.get("state") ?? "";

// ---- Kết nối ----

test("Bắt đầu kết nối: cần địa chỉ quay lại https (hoặc localhost) đúng đường dẫn, đã có Client ID và nhập đúng mật khẩu", async () => {
  const { service } = setup();
  for (const bad of ["http://cms.iorder.example" + gmailCallbackPath, "https://cms.iorder.example/admin/khac", `${redirectUri}?x=1`, `${redirectUri}#a`, "ftp://x" + gmailCallbackPath, "khong-phai-url"]) {
    await assert.rejects(service.startConnect({ userId: "u1", password: "p", redirectUri: bad }), (error: unknown) => error instanceof GmailError && error.code === "INVALID_REDIRECT", bad);
  }
  const { authUrl } = await service.startConnect({ userId: "u1", password: "p", redirectUri: `http://localhost:3001${gmailCallbackPath}` });
  assert.equal(new URL(authUrl).searchParams.get("client_id"), "cid.apps.googleusercontent.com");

  await assert.rejects(setup({ secrets: { google_oauth_client_id: undefined } }).service.startConnect({ userId: "u1", password: "p", redirectUri }), (error: unknown) => error instanceof GmailError && error.code === "CLIENT_MISSING");
  const wrong = setup({ passwordOk: false });
  await assert.rejects(wrong.service.startConnect({ userId: "u1", password: "sai", redirectUri }), /INVALID_PASSWORD/);
});

test("Trạng thái báo tình trạng khóa chủ để CMS giải thích vì sao Client ID đã nhập mà chưa đọc được", async () => {
  assert.equal((await setup().service.getStatus()).masterKey, "ok", "không truyền thì coi là ổn");
  const store = { settings: { ...defaultGmailSettings }, connection: null as GmailConnection | null };
  const service = createGmailService({
    repository: { readSettings: async () => ({ settings: store.settings, version: 1 }), readConnection: async () => store.connection } as unknown as GmailDependencies["repository"],
    secrets: { get: async () => undefined, put: async () => undefined, remove: async () => undefined, verifyPassword: async () => undefined, masterKeyState: async () => "missing" },
    env: {}, fetch: (async () => new Response("{}")) as typeof fetch, now: () => new Date(), log: () => undefined,
  });
  const status = await service.getStatus();
  assert.equal(status.masterKey, "missing");
  assert.equal(status.clientConfigured, false);
});

test("Biến môi trường GOOGLE_OAUTH_CLIENT_ID/SECRET được ưu tiên hơn giá trị lưu ở CMS", async () => {
  const { service } = setup({ env: { GOOGLE_OAUTH_CLIENT_ID: "env.apps.googleusercontent.com", GOOGLE_OAUTH_CLIENT_SECRET: "env-secret-1" } });
  const { authUrl } = await service.startConnect({ userId: "u1", password: "p", redirectUri });
  assert.equal(new URL(authUrl).searchParams.get("client_id"), "env.apps.googleusercontent.com");
  assert.equal((await service.getStatus()).clientConfigured, true);
});

test("Hoàn tất kết nối: đổi mã lấy token, lưu token (mã hóa ở kho khóa) và tài khoản; state chỉ dùng được một lần", async () => {
  const { service, store, calls } = setup();
  const { authUrl } = await service.startConnect({ userId: "u1", password: "p", redirectUri });
  const state = stateOf(authUrl);
  const connection = await service.finishConnect({ userId: "u1", code: "ma-tu-google", state });
  assert.equal(connection.email, "chu.so.huu@gmail.com");
  assert.equal(connection.status, "connected");
  assert.equal(connection.cmsOrigin, "https://cms.iorder.example");
  assert.equal(store.secrets.gmail_refresh_token, "refresh-token-0123456789");
  const exchange = calls.find((call) => call.form.grant_type === "authorization_code");
  assert.equal(exchange?.form.redirect_uri, redirectUri);
  assert.equal(exchange?.form.code, "ma-tu-google");
  assert.ok(exchange?.form.code_verifier && exchange.form.code_verifier.length >= 43, "gửi code_verifier của PKCE");
  await assert.rejects(service.finishConnect({ userId: "u1", code: "ma-tu-google", state }), (error: unknown) => error instanceof GmailError && error.code === "STATE_INVALID");
});

test("State sai, của người khác hoặc đã hết hạn đều bị từ chối và không đổi mã", async () => {
  const { service, calls, clock } = setup();
  const start = async () => stateOf((await service.startConnect({ userId: "u1", password: "p", redirectUri })).authUrl);
  await assert.rejects(service.finishConnect({ userId: "u1", code: "c", state: "x".repeat(32) }), /hết hạn hoặc không hợp lệ/);
  const stolen = await start();
  await assert.rejects(service.finishConnect({ userId: "u2", code: "c", state: stolen }), (error: unknown) => error instanceof GmailError && error.code === "STATE_INVALID");
  await assert.rejects(service.finishConnect({ userId: "u1", code: "c", state: stolen }), (error: unknown) => error instanceof GmailError && error.code === "STATE_INVALID", "state bị lộ thì dùng một lần là hết");
  const expired = await start();
  clock.time += 11 * 60 * 1000;
  await assert.rejects(service.finishConnect({ userId: "u1", code: "c", state: expired }), (error: unknown) => error instanceof GmailError && error.code === "STATE_INVALID");
  assert.equal(calls.filter((call) => call.url === googleTokenUrl).length, 0);
});

test("Google từ chối đổi mã thì báo lỗi dễ hiểu và không lưu token", async () => {
  const { service, store } = setup({ respond: (call) => call.url === googleTokenUrl ? json({ error: "redirect_uri_mismatch" }, 400) : undefined });
  const { authUrl } = await service.startConnect({ userId: "u1", password: "p", redirectUri });
  await assert.rejects(service.finishConnect({ userId: "u1", code: "c", state: stateOf(authUrl) }), (error: unknown) => error instanceof GmailError && error.code === "GOOGLE_ERROR" && /Authorized redirect URIs/.test(error.message));
  assert.equal(store.secrets.gmail_refresh_token, undefined);
  assert.equal(store.connection, null);
});

test("Kết nối lại thu hồi token cũ ở Google", async () => {
  const { service, calls } = setup({ secrets: { gmail_refresh_token: "token-cu-0123456789abc" }, connection: connected() });
  const { authUrl } = await service.startConnect({ userId: "u1", password: "p", redirectUri });
  await service.finishConnect({ userId: "u1", code: "c", state: stateOf(authUrl) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.filter((call) => call.url === googleRevokeUrl).map((call) => call.form.token), ["token-cu-0123456789abc"]);
});

test("Ngắt kết nối: cần mật khẩu, thu hồi quyền ở Google, xóa token và tài khoản", async () => {
  const wrong = setup({ connection: connected(), secrets: { gmail_refresh_token: "refresh-token-0123456789" }, passwordOk: false });
  await assert.rejects(wrong.service.disconnect({ userId: "u1", password: "sai" }), /INVALID_PASSWORD/);
  assert.ok(wrong.store.connection && wrong.store.secrets.gmail_refresh_token, "sai mật khẩu thì không xóa gì");

  const { service, store, calls } = setup({ connection: connected(), secrets: { gmail_refresh_token: "refresh-token-0123456789" } });
  await service.disconnect({ userId: "u1", password: "p" });
  assert.equal(store.connection, null);
  assert.equal(store.secrets.gmail_refresh_token, undefined);
  assert.deepEqual(calls.filter((call) => call.url === googleRevokeUrl).map((call) => call.form.token), ["refresh-token-0123456789"]);
});

// ---- Cài đặt ----

test("Cài đặt: bật cần đã kết nối; sai version báo xung đột; CC được chuẩn hóa, không trùng, tối đa 10", async () => {
  const noConnection = setup();
  await assert.rejects(noConnection.service.updateSettings("u1", { enabled: true, cc: [], expectedVersion: 3 }), (error: unknown) => error instanceof GmailError && error.code === "NOT_CONNECTED");
  const { service, store } = setup({ connection: connected() });
  const status = await service.updateSettings("u1", { enabled: true, cc: ["  Anh.B@Gmail.com ", "c@gmail.com"], expectedVersion: 3 });
  assert.deepEqual(store.settings, { enabled: true, cc: ["anh.b@gmail.com", "c@gmail.com"] });
  assert.equal(status.version, 4);
  await assert.rejects(service.updateSettings("u1", { enabled: false, cc: [], expectedVersion: 3 }), ContentVersionConflictError);
  await assert.rejects(service.updateSettings("u1", { enabled: true, cc: ["a@x.com", "A@x.com"], expectedVersion: 4 }), ZodError);
  await assert.rejects(service.updateSettings("u1", { enabled: true, cc: ["khong-phai-email"], expectedVersion: 4 }), ZodError);
  await assert.rejects(service.updateSettings("u1", { enabled: true, cc: Array.from({ length: 11 }, (_, index) => `n${index}@x.com`), expectedVersion: 4 }), ZodError);
});

// ---- Báo liên hệ mới ----

test("Tắt hoặc chưa kết nối thì không gửi và không gọi Google", async () => {
  const off = setup({ connection: connected(), settings: { enabled: false } });
  assert.deepEqual(await off.service.notifyNewLead(lead), { sent: false, reason: "disabled" });
  const none = setup({ settings: { enabled: true } });
  assert.deepEqual(await none.service.notifyNewLead(lead), { sent: false, reason: "not_connected" });
  assert.equal(off.calls.length + none.calls.length, 0);
});

test("Liên hệ mới: gửi từ Gmail đã kết nối tới chính nó, CC các địa chỉ đã chọn, tiêu đề có tên và số điện thoại", async () => {
  const { service, calls, store } = setup({ connection: connected(), settings: { enabled: true, cc: ["a@gmail.com", "b@gmail.com"] }, secrets: { gmail_refresh_token: "refresh-token-0123456789" } });
  assert.deepEqual(await service.notifyNewLead(lead), { sent: true });
  const send = calls.find((call) => call.url === gmailSendUrl);
  assert.ok(send);
  assert.match(send.authorization ?? "", /^Bearer at-/);
  const mime = sentMime(send);
  assert.match(mime, /^From: chu\.so\.huu@gmail\.com\r\nTo: chu\.so\.huu@gmail\.com\r\nCc: a@gmail\.com, b@gmail\.com\r\n/);
  const subject = /Subject: ([\s\S]*?)\r\nMIME-Version/.exec(mime)?.[1] ?? "";
  const decoded = subject.split(/\r\n /).map((word) => Buffer.from(/^=\?UTF-8\?B\?(.+)\?=$/.exec(word)?.[1] ?? "", "base64").toString("utf8")).join("");
  assert.equal(decoded, "[iOrder] Liên hệ mới: Nguyễn Văn A · 0901234567");
  const body = Buffer.from(mime.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString("utf8");
  assert.match(body, /Số điện thoại: 0901234567/);
  assert.match(body, /Mở trong CMS: https:\/\/cms\.iorder\.example\/admin\/leads\?open=6f1c2a52/);
  assert.equal(store.connection?.lastSentAt, "2026-11-26T03:00:00.000Z");
  assert.equal(store.connection?.lastError, null);
});

test("Access token được giữ lại giữa các thư; hết hạn hoặc bị từ chối (401) thì làm mới đúng một lần rồi gửi lại", async () => {
  const { service, calls, clock } = setup({ connection: connected(), settings: { enabled: true }, secrets: { gmail_refresh_token: "refresh-token-0123456789" } });
  await service.notifyNewLead(lead);
  await service.notifyNewLead(lead);
  assert.equal(calls.filter((call) => call.form.grant_type === "refresh_token").length, 1, "hai thư dùng chung một access token");
  clock.time += 3600 * 1000;
  await service.notifyNewLead(lead);
  assert.equal(calls.filter((call) => call.form.grant_type === "refresh_token").length, 2, "hết hạn thì làm mới");

  let rejected = false;
  const retry = setup({ connection: connected(), settings: { enabled: true }, secrets: { gmail_refresh_token: "refresh-token-0123456789" }, respond: (call) => {
    if (call.url !== gmailSendUrl || rejected) return undefined;
    rejected = true;
    return json({ error: { status: "UNAUTHENTICATED", message: "Invalid Credentials" } }, 401);
  } });
  assert.deepEqual(await retry.service.notifyNewLead(lead), { sent: true });
  assert.equal(retry.calls.filter((call) => call.url === gmailSendUrl).length, 2);
  assert.equal(retry.calls.filter((call) => call.form.grant_type === "refresh_token").length, 2);
});

test("Google thu hồi quyền (invalid_grant): đánh dấu cần kết nối lại, ghi lỗi để CMS hiện và ngừng gọi Google", async () => {
  const { service, store, calls } = setup({ connection: connected(), settings: { enabled: true }, secrets: { gmail_refresh_token: "refresh-token-0123456789" }, respond: (call) => call.url === googleTokenUrl ? json({ error: "invalid_grant" }, 400) : undefined });
  assert.deepEqual(await service.notifyNewLead(lead), { sent: false, reason: "error" });
  assert.equal(store.connection?.status, "needs_reconnect");
  assert.match(store.connection?.lastError ?? "", /Kết nối lại/);
  const before = calls.length;
  assert.deepEqual(await service.notifyNewLead(lead), { sent: false, reason: "not_connected" });
  assert.equal(calls.length, before);
});

test("Thư lỗi không bao giờ ném ra ngoài: lỗi Gmail, lỗi mạng và lỗi đọc cài đặt đều thành kết quả", async () => {
  const gmailDown = setup({ connection: connected(), settings: { enabled: true }, secrets: { gmail_refresh_token: "refresh-token-0123456789" }, respond: (call) => call.url === gmailSendUrl ? json({ error: { status: "UNAVAILABLE", message: "Backend Error" } }, 503) : undefined });
  assert.deepEqual(await gmailDown.service.notifyNewLead(lead), { sent: false, reason: "error" });
  assert.equal(gmailDown.store.connection?.status, "connected", "lỗi tạm thời không bắt kết nối lại");
  assert.match(gmailDown.store.connection?.lastError ?? "", /Backend Error/);
  assert.ok(gmailDown.logs.length >= 1);

  const broken = setup({ connection: connected(), settings: { enabled: true } });
  const original = broken.store;
  Object.defineProperty(original, "settings", { get() { throw new Error("database sập"); } });
  assert.deepEqual(await broken.service.notifyNewLead(lead), { sent: false, reason: "error" });
});

test("Giới hạn 20 thư trong 10 phút: vượt thì bỏ qua (liên hệ vẫn được lưu), qua cửa sổ thì gửi lại", async () => {
  const { service, calls, clock, logs } = setup({ connection: connected(), settings: { enabled: true }, secrets: { gmail_refresh_token: "refresh-token-0123456789" } });
  const results = [];
  for (let index = 0; index < 25; index++) results.push(await service.notifyNewLead(lead));
  assert.equal(results.filter((result) => result.sent).length, 20);
  assert.deepEqual(results[24], { sent: false, reason: "rate_limited" });
  assert.equal(calls.filter((call) => call.url === gmailSendUrl).length, 20);
  assert.ok(logs.some((message) => /giới hạn/.test(message)));
  clock.time += 10 * 60 * 1000 + 1;
  assert.deepEqual(await service.notifyNewLead(lead), { sent: true });
});

test("Thư thử gửi tới tài khoản đã kết nối kèm CC và ghi nhật ký; chưa kết nối thì báo rõ", async () => {
  const { service, store } = setup({ connection: connected(), settings: { enabled: true, cc: ["a@gmail.com"] }, secrets: { gmail_refresh_token: "refresh-token-0123456789" } });
  assert.deepEqual(await service.sendTest("u1"), { to: "chu.so.huu@gmail.com", cc: ["a@gmail.com"] });
  assert.ok(store.audit.includes("test"));
  assert.equal(store.connection?.lastSentAt, "2026-11-26T03:00:00.000Z");
  await assert.rejects(setup().service.sendTest("u1"), (error: unknown) => error instanceof GmailError && error.code === "NOT_CONNECTED");
  const failing = setup({ connection: connected(), secrets: { gmail_refresh_token: "refresh-token-0123456789" }, respond: (call) => call.url === gmailSendUrl ? json({ error: { status: "PERMISSION_DENIED", message: "Gmail API has not been used in project" } }, 403) : undefined });
  await assert.rejects(failing.service.sendTest("u1"), (error: unknown) => error instanceof GmailError && error.code === "GOOGLE_ERROR" && /Gmail API has not been used/.test(error.message));
});

test("Trạng thái cho CMS: có Client ID chưa, tài khoản đã kết nối, cài đặt và version; không chứa token hay mã bí mật", async () => {
  const { service } = setup({ connection: connected(), settings: { enabled: true, cc: ["a@gmail.com"] }, secrets: { gmail_refresh_token: "refresh-token-0123456789" } });
  const status = await service.getStatus();
  assert.equal(status.clientConfigured, true);
  assert.equal(status.connection?.email, "chu.so.huu@gmail.com");
  assert.deepEqual(status.settings, { enabled: true, cc: ["a@gmail.com"] });
  assert.equal(status.callbackPath, gmailCallbackPath);
  const text = JSON.stringify(status);
  assert.ok(!text.includes("refresh-token") && !text.includes("csecret"));
});

// ---- Danh sách kết nối đang chờ ----

test("Danh sách chờ: dùng một lần, hết hạn theo thời gian, giới hạn số lượng", () => {
  let time = 0;
  const pending = createPendingConnections({ now: () => time, ttlMs: 1000, maxEntries: 3 });
  const state = pending.create({ userId: "u1", redirectUri: "https://x/cb", verifier: "v" });
  assert.deepEqual(pending.consume(state, "u1"), { userId: "u1", redirectUri: "https://x/cb", verifier: "v" });
  assert.equal(pending.consume(state, "u1"), null);
  const early = pending.create({ userId: "u1", redirectUri: "https://x/cb", verifier: "v" });
  time = 1000;
  assert.equal(pending.consume(early, "u1"), null);
  const states = Array.from({ length: 5 }, () => pending.create({ userId: "u1", redirectUri: "https://x/cb", verifier: "v" }));
  assert.ok(pending.size() <= 4);
  assert.equal(pending.consume(states[0], "u1"), null, "bắt đầu quá nhiều lần thì bỏ những lần cũ nhất");
  assert.ok(pending.consume(states[4], "u1"));
});
