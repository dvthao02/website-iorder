import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ContentVersionConflictError } from "../shared/content-version";
import { normalizeSecret, SecretValidationError } from "./secrets.catalog";
import { integrationTools, secretMetas, setSecretRequestSchema, setSecretsRequestSchema, clearSecretRequestSchema } from "./secrets.contract";
import { decryptSecret, encryptSecret, parseMasterKey, SecretsError } from "./secrets.crypto";
import { createKeyFileStore, MasterKeyFileExistsError, resolveKeyFilePath, type KeyFileStore } from "./secrets.keyfile";
import { createSecretsService, InvalidPasswordError, isMissingTableError, MasterKeyExistsError, TooManyAttemptsError, type SecretsDependencies, type SecretsRepository, type StoredSecretRow } from "./secrets.service";

const masterKeyText = randomBytes(32).toString("base64");
const master = parseMasterKey(masterKeyText);
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const email = "cms@du-an.iam.gserviceaccount.com";
const serviceAccountJson = JSON.stringify({ type: "service_account", project_id: "du-an-bi-mat", private_key_id: "abc123", client_email: email, private_key: privateKey, client_id: "1", token_uri: "https://oauth2.googleapis.com/token" });
const goodPassword = "mat-khau-dung";

test("Khóa chủ: phải là base64 của đúng 32 byte; thiếu hoặc sai định dạng thì báo lỗi riêng", () => {
  assert.equal(parseMasterKey(masterKeyText).length, 32);
  assert.throws(() => parseMasterKey(undefined), (error: SecretsError) => error.code === "MASTER_KEY_MISSING");
  assert.throws(() => parseMasterKey("   "), (error: SecretsError) => error.code === "MASTER_KEY_MISSING");
  for (const bad of ["ngan", "mat khau tu dat khong phai base64!", randomBytes(16).toString("base64"), randomBytes(48).toString("base64")]) {
    assert.throws(() => parseMasterKey(bad), (error: SecretsError) => error.code === "MASTER_KEY_INVALID", bad);
  }
});

test("Mã hóa AES-256-GCM: giải mã đúng (kể cả tiếng Việt), mỗi lần mã hóa ra bản khác nhau, bản mã không chứa giá trị gốc", () => {
  const plaintext = "khóa-bí-mật-ya29.Ví-dụ/đặc+biệt==";
  const payload = encryptSecret(plaintext, "umami_api_key", master);
  assert.match(payload, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/);
  assert.ok(!payload.includes(plaintext) && !payload.includes("bí-mật"));
  assert.equal(decryptSecret(payload, "umami_api_key", master), plaintext);
  assert.notEqual(encryptSecret(plaintext, "umami_api_key", master), payload, "nonce ngẫu nhiên nên hai bản mã khác nhau");
  assert.equal(decryptSecret(encryptSecret("", "umami_api_key", master), "umami_api_key", master), "");
});

test("Giải mã thất bại cùng một lỗi chung: sai khóa chủ, bản mã bị sửa, hoán đổi sang khóa khác (AAD), định dạng lạ", () => {
  const plaintext = "gia-tri-tuyet-mat";
  const payload = encryptSecret(plaintext, "umami_api_key", master);
  const otherMaster = parseMasterKey(randomBytes(32).toString("base64"));
  const [version, nonce, tag, encrypted] = payload.split(".");
  const flipped = Buffer.from(encrypted, "base64url");
  flipped[0] ^= 1;
  const attempts = [
    () => decryptSecret(payload, "umami_api_key", otherMaster),
    () => decryptSecret([version, nonce, tag, flipped.toString("base64url")].join("."), "umami_api_key", master),
    () => decryptSecret(payload, "google_service_account", master),
    () => decryptSecret("v2." + payload.slice(3), "umami_api_key", master),
    () => decryptSecret("khong-phai-ban-ma", "umami_api_key", master),
    () => decryptSecret("", "umami_api_key", master),
  ];
  for (const attempt of attempts) {
    assert.throws(attempt, (error: SecretsError) => error.code === "DECRYPT_FAILED" && !error.message.includes(plaintext) && /Không giải mã được/.test(error.message));
  }
});

test("Khóa Google: chỉ giữ email và khóa riêng (bỏ project_id…), gợi ý là email; tệp sai báo lỗi mà không lặp lại nội dung", () => {
  const normalized = normalizeSecret("google_service_account", serviceAccountJson);
  assert.deepEqual(JSON.parse(normalized.value), { type: "service_account", client_email: email, private_key: privateKey });
  assert.equal(normalized.hint, email);
  assert.ok(!normalized.value.includes("du-an-bi-mat") && !normalized.value.includes("abc123"));
  for (const bad of ["khong phai json co chuoi bi mat xyz", JSON.stringify({ client_email: email }), JSON.stringify({ client_email: "", private_key: privateKey })]) {
    assert.throws(() => normalizeSecret("google_service_account", bad), (error: Error) => error instanceof SecretValidationError && !error.message.includes("bi mat xyz"), bad);
  }
});

test("Thuộc tính Search Console và API key Umami: kiểm tra định dạng, gợi ý chỉ lộ phần không bí mật", () => {
  for (const good of ["sc-domain:iorder.com.vn", "https://iorder.com.vn/", "  https://www.iorder.vn/  "]) assert.equal(normalizeSecret("search_console_property", good).value, good.trim(), good);
  assert.equal(normalizeSecret("search_console_property", "sc-domain:iorder.vn").hint, "sc-domain:iorder.vn");
  for (const bad of ["iorder.vn", "https://iorder.vn", "ftp://iorder.vn/", "sc-domain:", "sc-domain:bad domain", "https://a b/"]) assert.throws(() => normalizeSecret("search_console_property", bad), SecretValidationError, bad);

  const key = normalizeSecret("umami_api_key", "  umami_abcdefghijklmnop1234  ");
  assert.equal(key.value, "umami_abcdefghijklmnop1234");
  assert.equal(key.hint, "••••1234");
  assert.ok(!key.hint.includes("abcdefgh"));
  for (const bad of ["ngan", "co khoang trang giua 12345", "x".repeat(501)]) assert.throws(() => normalizeSecret("umami_api_key", bad), SecretValidationError, bad);
});

test("Biến kết nối Umami: địa chỉ gốc (bỏ dấu / cuối, không đường dẫn hay tên đăng nhập), mã website là UUID viết thường; cả hai hiện lại được vì không bí mật", () => {
  assert.deepEqual(normalizeSecret("umami_api_url", "  https://thongke.iorder.vn/  "), { value: "https://thongke.iorder.vn", hint: "https://thongke.iorder.vn" });
  assert.equal(normalizeSecret("umami_api_url", "http://umami:3000").value, "http://umami:3000");
  for (const bad of ["thongke.iorder.vn", "ftp://umami:3000", "https://u:p@umami.vn", "https://umami.vn/api", "https://umami.vn?x=1", "https://umami.vn/#a", "http://" + "a".repeat(250) + ".vn"]) assert.throws(() => normalizeSecret("umami_api_url", bad), SecretValidationError, bad);
  const id = "3F2B8C1E-5D4A-4B7E-9C10-0A1B2C3D4E5F";
  assert.deepEqual(normalizeSecret("umami_website_id", " " + id + " "), { value: id.toLowerCase(), hint: id.toLowerCase() });
  for (const bad of ["", "khong-phai-uuid", id + "x", "3f2b8c1e5d4a4b7e9c100a1b2c3d4e5f"]) assert.throws(() => normalizeSecret("umami_website_id", bad), SecretValidationError, bad);
  assert.equal(secretMetas.umami_api_url.exposeValue && secretMetas.umami_website_id.exposeValue && !secretMetas.umami_api_key.exposeValue, true);
});

test("Yêu cầu từ trình duyệt: khóa phải thuộc danh mục, bắt buộc có mật khẩu xác nhận", () => {
  assert.equal(setSecretRequestSchema.safeParse({ key: "umami_api_key", value: "x".repeat(10), password: goodPassword }).success, true);
  assert.equal(setSecretRequestSchema.safeParse({ key: "DATABASE_URL", value: "x", password: goodPassword }).success, false, "không cho đặt khóa ngoài danh mục");
  assert.equal(setSecretRequestSchema.safeParse({ key: "umami_api_key", value: "x" }).success, false, "thiếu mật khẩu");
  assert.equal(setSecretRequestSchema.safeParse({ key: "umami_api_key", value: "", password: goodPassword }).success, false);
  assert.equal(clearSecretRequestSchema.safeParse({ key: "umami_api_key", password: "" }).success, false);
  assert.deepEqual(Object.keys(secretMetas).sort(), ["gmail_refresh_token", "google_oauth_client_id", "google_oauth_client_secret", "google_service_account", "search_console_property", "umami_api_key", "umami_api_url", "umami_website_id"]);
  const grouped = integrationTools.flatMap((tool) => [...tool.keys]).sort();
  // Token làm mới của Gmail do máy chủ tự ghi sau khi Google cấp quyền: không có ô nhập nên không thuộc thẻ công cụ nào.
  assert.deepEqual(grouped, Object.keys(secretMetas).filter((key) => key !== "gmail_refresh_token").sort(), "mỗi biến kết nối thuộc đúng một công cụ");
});

// ---- Dịch vụ với kho giả trong bộ nhớ ----

type Setup = { env?: Record<string, string | undefined>; clock?: { time: number }; keyFile?: KeyFileStore };

/** Tệp khóa chủ giả trong bộ nhớ: create() sinh khóa ngẫu nhiên như thật, không ghi đè khóa đã có. */
function fakeKeyFile(initial?: string, options: { unreadable?: boolean; createFails?: boolean } = {}) {
  const state = { text: initial, creates: 0 };
  const store: KeyFileStore = {
    path: "/data/secrets/master.key",
    async read() { if (options.unreadable) throw Object.assign(new Error("EACCES"), { code: "EACCES" }); return state.text; },
    async create() {
      if (options.createFails) throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      if (state.text !== undefined) throw new MasterKeyFileExistsError();
      state.text = randomBytes(32).toString("base64");
      state.creates += 1;
    },
  };
  return { store, state };
}

function setup(options: Setup = {}) {
  const rows = new Map<string, { payload: string; hint: string; version: number; updatedAt: Date; userId: string }>();
  const calls = { upsert: 0, remove: 0, failedReauth: [] as string[], logs: [] as string[], masterKeyCreated: [] as string[] };
  const clock = options.clock ?? { time: Date.parse("2026-11-19T10:00:00Z") };
  const repository: SecretsRepository = {
    async list(): Promise<StoredSecretRow[]> { return [...rows].map(([key, row]) => ({ key, hint: row.hint, version: row.version, updatedAt: row.updatedAt, updatedByName: row.userId === "u1" ? "Administrator" : null })); },
    async findPayload(key) { return rows.get(key)?.payload; },
    async upsert({ key, payload, hint, userId, expectedVersion }) {
      const before = rows.get(key);
      if (expectedVersion !== undefined && (before?.version ?? 0) !== expectedVersion) throw new ContentVersionConflictError();
      calls.upsert += 1;
      rows.set(key, { payload, hint, userId, version: (before?.version ?? 0) + 1, updatedAt: new Date(clock.time) });
    },
    async remove({ key }) { calls.remove += 1; return rows.delete(key); },
    async passwordHash(userId) { return userId === "u1" ? "hash-cua-u1" : undefined; },
    async recordFailedReauth({ userId, key }) { calls.failedReauth.push(`${userId}:${key}`); },
    async recordMasterKeyCreated({ userId }) { calls.masterKeyCreated.push(userId); },
  };
  const dependencies: SecretsDependencies = {
    repository, env: { SECRETS_MASTER_KEY: masterKeyText, ...options.env }, now: () => new Date(clock.time), keyFile: options.keyFile,
    verifyPassword: async (password, hash) => hash === "hash-cua-u1" && password === goodPassword,
    log: (message, context) => { calls.logs.push(`${message} ${JSON.stringify(context ?? {})}`); },
  };
  return { service: createSecretsService(dependencies), rows, calls, clock, dependencies };
}

const umami = "umami_khoa-bi-mat-1234567890";

test("Đặt khóa: cần mật khẩu đúng; lưu bản mã (không phải giá trị gốc), trạng thái chỉ có gợi ý, giải mã nội bộ ra đúng giá trị", async () => {
  const { service, rows } = setup();
  const before = await service.getOverview();
  assert.equal(before.masterKey, "ok");
  assert.deepEqual(before.secrets.map((item) => [item.key, item.state]), [["google_service_account", "none"], ["search_console_property", "none"], ["umami_api_url", "none"], ["umami_website_id", "none"], ["umami_api_key", "none"], ["google_oauth_client_id", "none"], ["google_oauth_client_secret", "none"], ["gmail_refresh_token", "none"]]);

  const status = await service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword });
  assert.deepEqual([status.state, status.storedInCms, status.hint, status.version, status.updatedByName], ["cms", true, "••••7890", 1, "Administrator"]);
  const stored = rows.get("umami_api_key")!;
  assert.ok(!stored.payload.includes(umami) && stored.payload.startsWith("v1."), "trong kho chỉ có bản mã");
  assert.equal(await service.getCmsSecret("umami_api_key"), umami, "dịch vụ nội bộ lấy lại được đúng giá trị");
  assert.ok(!JSON.stringify(await service.getOverview()).includes(umami), "trạng thái không bao giờ chứa giá trị khóa");
});

test("Khóa do máy chủ sinh ra (token Gmail): ghi không cần mật khẩu nhưng vẫn mã hóa; xác nhận mật khẩu riêng, sai thì chặn và ghi nhật ký", async () => {
  const { service, rows, calls } = setup();
  const token = "1//0g-refresh-token-cua-google-0123456789";
  await service.putServerSecret({ userId: "u1", key: "gmail_refresh_token", value: token });
  const stored = rows.get("gmail_refresh_token")!;
  assert.ok(!stored.payload.includes(token) && stored.payload.startsWith("v1."), "trong kho chỉ có bản mã");
  assert.equal(stored.hint, "Đã kết nối", "gợi ý không chứa token");
  assert.equal(await service.getCmsSecret("gmail_refresh_token"), token);
  assert.ok(!JSON.stringify(await service.getOverview()).includes(token), "trạng thái không bao giờ chứa token");
  await assert.rejects(service.putServerSecret({ userId: "u1", key: "gmail_refresh_token", value: "ngan" }), SecretValidationError);

  await service.verifyReauthentication({ userId: "u1", password: goodPassword, subject: "gmail_refresh_token" });
  await assert.rejects(service.verifyReauthentication({ userId: "u1", password: "sai-mat-khau", subject: "gmail_refresh_token" }), InvalidPasswordError);
  assert.deepEqual(calls.failedReauth, ["u1:gmail_refresh_token"]);

  await service.removeServerSecret({ userId: "u1", key: "gmail_refresh_token" });
  assert.equal(rows.has("gmail_refresh_token"), false);
  assert.equal(await service.getCmsSecret("gmail_refresh_token"), undefined);
});

test("Lưu nhiều biến của một công cụ: một lần xác nhận mật khẩu, kiểm tra hết rồi mới ghi (một biến sai thì không biến nào được lưu), lỗi chỉ đúng biến sai", async () => {
  const { service, rows, calls } = setup();
  const id = "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f";
  const statuses = await service.setSecrets({ userId: "u1", password: goodPassword, items: [
    { key: "umami_api_url", value: "http://umami:3000/" },
    { key: "umami_website_id", value: id },
    { key: "umami_api_key", value: umami },
  ] });
  assert.deepEqual(statuses.map((item) => [item.key, item.state, item.hint]), [["umami_api_url", "cms", "http://umami:3000"], ["umami_website_id", "cms", id], ["umami_api_key", "cms", "••••7890"]]);
  assert.equal(calls.upsert, 3);
  assert.equal(await service.getCmsSecret("umami_website_id"), id);

  // Một biến sai: không ghi gì (kể cả biến hợp lệ đứng trước), lỗi nêu đúng biến; mật khẩu sai thì không xét giá trị.
  const fresh = setup();
  await assert.rejects(fresh.service.setSecrets({ userId: "u1", password: goodPassword, items: [{ key: "umami_api_url", value: "https://thongke.iorder.vn" }, { key: "umami_website_id", value: "khong-phai-uuid" }] }), (error: Error) => error instanceof SecretValidationError && error.key === "umami_website_id");
  assert.equal(fresh.calls.upsert, 0, "không biến nào được lưu");
  assert.equal(fresh.rows.size, 0);
  await assert.rejects(fresh.service.setSecrets({ userId: "u1", password: "sai-mat-khau", items: [{ key: "umami_api_url", value: "https://thongke.iorder.vn" }] }), InvalidPasswordError);
  assert.equal(fresh.calls.upsert, 0);
  assert.deepEqual(fresh.calls.failedReauth, ["u1:umami_api_url"]);

  // Va chạm phiên bản: dùng expectedVersion đã cũ thì bị từ chối.
  await assert.rejects(service.setSecrets({ userId: "u1", password: goodPassword, items: [{ key: "umami_api_url", value: "http://umami:3000", expectedVersion: 0 }] }), ContentVersionConflictError);
  assert.equal(rows.get("umami_api_url")!.version, 1);

  assert.equal(setSecretsRequestSchema.safeParse({ items: [], password: goodPassword }).success, false, "cần ít nhất một biến");
  assert.equal(setSecretsRequestSchema.safeParse({ items: [{ key: "umami_api_url", value: "a" }, { key: "umami_api_url", value: "b" }], password: goodPassword }).success, false, "một biến chỉ nhập một lần");
  assert.equal(setSecretsRequestSchema.safeParse({ items: [{ key: "DATABASE_URL", value: "a" }], password: goodPassword }).success, false, "không cho đặt khóa ngoài danh mục");
  assert.equal(setSecretsRequestSchema.safeParse({ items: [{ key: "umami_api_url", value: "a" }], password: "" }).success, false, "thiếu mật khẩu");
});

test("Khóa Google nhập từ tệp: lưu mã hóa, hiển thị lại email, khóa riêng không xuất hiện trong trạng thái", async () => {
  const { service } = setup();
  const status = await service.setSecret({ userId: "u1", key: "google_service_account", value: serviceAccountJson, password: goodPassword });
  assert.equal(status.hint, email);
  const serialized = JSON.stringify(await service.getOverview());
  assert.ok(!serialized.includes("PRIVATE KEY") && !serialized.includes(privateKey.slice(40, 80)) && !serialized.includes("du-an-bi-mat"));
  assert.deepEqual(JSON.parse((await service.getCmsSecret("google_service_account"))!), { type: "service_account", client_email: email, private_key: privateKey });
});

test("Sai mật khẩu: bị từ chối, không ghi gì, ghi nhật ký lần thử sai; mật khẩu của người khác hoặc người không tồn tại cũng không qua", async () => {
  const { service, calls } = setup();
  await assert.rejects(service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: "sai" }), InvalidPasswordError);
  await assert.rejects(service.setSecret({ userId: "khong-ton-tai", key: "umami_api_key", value: umami, password: goodPassword }), InvalidPasswordError);
  assert.equal(calls.upsert, 0);
  assert.deepEqual(calls.failedReauth, ["u1:umami_api_key", "khong-ton-tai:umami_api_key"]);
  assert.equal(await service.getCmsSecret("umami_api_key"), undefined);
});

test("Chặn dò mật khẩu: sai 5 lần thì khóa tạm kể cả khi nhập đúng; hết 15 phút thì dùng lại; nhập đúng thì xóa bộ đếm", async () => {
  const { service, clock } = setup();
  for (let i = 0; i < 5; i += 1) await assert.rejects(service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: `sai${i}` }), InvalidPasswordError);
  await assert.rejects(service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword }), TooManyAttemptsError);
  clock.time += 16 * 60_000;
  assert.equal((await service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword })).state, "cms");

  // Đúng một lần là xóa bộ đếm: 4 lần sai nữa vẫn chưa bị khóa.
  for (let i = 0; i < 4; i += 1) await assert.rejects(service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: "sai" }), InvalidPasswordError);
  assert.equal((await service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword })).version, 2);
});

test("Chưa có hoặc sai khóa chủ: không lưu được và không xét mật khẩu; đọc khóa đã lưu thì trả undefined kèm cảnh báo, không ném lỗi", async () => {
  const noMaster = setup({ env: { SECRETS_MASTER_KEY: undefined } });
  assert.equal((await noMaster.service.getOverview()).masterKey, "missing");
  await assert.rejects(noMaster.service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: "sai" }), (error: SecretsError) => error.code === "MASTER_KEY_MISSING");
  assert.equal(noMaster.calls.failedReauth.length, 0, "chưa dùng được kho thì không tính là thử mật khẩu");
  assert.equal((await setup({ env: { SECRETS_MASTER_KEY: "sai-dinh-dang" } }).service.getOverview()).masterKey, "invalid");

  // Đã lưu bằng khóa chủ cũ rồi đổi khóa chủ: không giải mã được, dịch vụ coi như chưa cấu hình.
  const first = setup();
  await first.service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword });
  const rotated = createSecretsService({ ...first.dependencies, env: { SECRETS_MASTER_KEY: randomBytes(32).toString("base64") } });
  assert.equal(await rotated.getCmsSecret("umami_api_key"), undefined);
  assert.equal(first.calls.logs.length, 1, "có ghi cảnh báo phía máy chủ");
  assert.match(first.calls.logs[0], /DECRYPT_FAILED/);
  assert.ok(!first.calls.logs[0].includes(umami) && !first.calls.logs[0].includes(masterKeyText), "cảnh báo không chứa giá trị khóa hay khóa chủ");
});

test("Biến môi trường luôn thắng: trạng thái nêu rõ nguồn, giá trị ở CMS vẫn được giữ nhưng chưa có hiệu lực", async () => {
  const { service } = setup({ env: { UMAMI_API_KEY: "tu-bien-moi-truong", GOOGLE_SERVICE_ACCOUNT_FILE: "D:/bi-mat/khoa.json" } });
  await service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword });
  const overview = await service.getOverview();
  const byKey = Object.fromEntries(overview.secrets.map((item) => [item.key, item]));
  assert.deepEqual([byKey.umami_api_key.state, byKey.umami_api_key.envOverrides, byKey.umami_api_key.storedInCms], ["env", true, true]);
  assert.deepEqual([byKey.google_service_account.state, byKey.google_service_account.storedInCms], ["env", false], "biến FILE cũng tính là đã đặt");
  assert.equal(byKey.search_console_property.state, "none");
  assert.ok(!JSON.stringify(overview).includes("tu-bien-moi-truong") && !JSON.stringify(overview).includes("khoa.json"), "không lộ giá trị biến môi trường");
});

test("Thay khóa: cần đúng version đang thấy (409 nếu lệch), cache được làm mới ngay sau khi đổi", async () => {
  const { service, clock } = setup();
  await service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword });
  assert.equal(await service.getCmsSecret("umami_api_key"), umami);
  await assert.rejects(service.setSecret({ userId: "u1", key: "umami_api_key", value: "umami_moi-khoa-0987654321", password: goodPassword, expectedVersion: 0 }), ContentVersionConflictError);
  assert.equal(await service.getCmsSecret("umami_api_key"), umami, "đổi thất bại thì giá trị cũ vẫn dùng");
  const replaced = await service.setSecret({ userId: "u1", key: "umami_api_key", value: "umami_moi-khoa-0987654321", password: goodPassword, expectedVersion: 1 });
  assert.equal(replaced.version, 2);
  assert.equal(await service.getCmsSecret("umami_api_key"), "umami_moi-khoa-0987654321", "không phải chờ hết 30 giây");
  clock.time += 1;
});

test("Giá trị sai định dạng bị từ chối sau khi xác nhận mật khẩu, không ghi gì; xóa khỏi CMS cũng cần mật khẩu", async () => {
  const { service, calls } = setup();
  await assert.rejects(service.setSecret({ userId: "u1", key: "search_console_property", value: "iorder.vn", password: goodPassword }), SecretValidationError);
  assert.equal(calls.upsert, 0);
  await service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword });
  await assert.rejects(service.clearSecret({ userId: "u1", key: "umami_api_key", password: "sai" }), InvalidPasswordError);
  assert.equal(calls.remove, 0);
  assert.equal(await service.getCmsSecret("umami_api_key"), umami);
  const cleared = await service.clearSecret({ userId: "u1", key: "umami_api_key", password: goodPassword });
  assert.deepEqual([cleared.state, cleared.storedInCms], ["none", false]);
  assert.equal(await service.getCmsSecret("umami_api_key"), undefined);
});

test("Khóa chủ trong tệp: tạo ở CMS cần mật khẩu đúng, dùng được ngay không cần khởi động lại, không bao giờ ghi đè, biến môi trường thắng tệp", async () => {
  const file = fakeKeyFile();
  const { service, calls } = setup({ env: { SECRETS_MASTER_KEY: undefined }, keyFile: file.store });

  const before = await service.getOverview();
  assert.deepEqual([before.masterKey, before.masterKeySource, before.canCreateMasterKey, before.keyFilePath], ["missing", "none", true, "/data/secrets/master.key"]);
  await assert.rejects(service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword }), (error: SecretsError) => error.code === "MASTER_KEY_MISSING");

  await assert.rejects(service.createMasterKey({ userId: "u1", password: "sai" }), InvalidPasswordError);
  assert.equal(file.state.creates, 0, "sai mật khẩu thì không tạo gì");
  assert.deepEqual(calls.failedReauth, ["u1:master_key"]);

  const after = await service.createMasterKey({ userId: "u1", password: goodPassword });
  assert.deepEqual([after.masterKey, after.masterKeySource, after.canCreateMasterKey], ["ok", "file", false]);
  assert.deepEqual(calls.masterKeyCreated, ["u1"]);
  assert.ok(!JSON.stringify(after).includes(file.state.text!.trim()), "khóa chủ không bao giờ có trong phản hồi");

  // Dùng được ngay: lưu rồi đọc lại khóa API bằng khóa chủ vừa tạo.
  await service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword });
  assert.equal(await service.getCmsSecret("umami_api_key"), umami);

  // Không tạo lại (sẽ làm mất mọi khóa đã mã hóa).
  await assert.rejects(service.createMasterKey({ userId: "u1", password: goodPassword }), MasterKeyExistsError);
  assert.equal(file.state.creates, 1);

  // Biến môi trường thắng tệp: nguồn là env, và cũng không cho tạo.
  const both = setup({ env: { SECRETS_MASTER_KEY: masterKeyText }, keyFile: fakeKeyFile(randomBytes(32).toString("base64")).store });
  assert.equal((await both.service.getOverview()).masterKeySource, "env");
  await assert.rejects(both.service.createMasterKey({ userId: "u1", password: goodPassword }), MasterKeyExistsError);
});

test("Khóa chủ trong tệp: tệp sai định dạng hoặc không đọc được thì báo invalid và KHÔNG cho tạo đè; máy chủ không cho ghi tệp thì báo lỗi rõ, không lộ chi tiết", async () => {
  const invalidFile = setup({ env: { SECRETS_MASTER_KEY: undefined }, keyFile: fakeKeyFile("khong-phai-khoa-hop-le").store });
  const invalid = await invalidFile.service.getOverview();
  assert.deepEqual([invalid.masterKey, invalid.masterKeySource, invalid.canCreateMasterKey], ["invalid", "file", false]);
  await assert.rejects(invalidFile.service.createMasterKey({ userId: "u1", password: goodPassword }), MasterKeyExistsError);

  const unreadable = setup({ env: { SECRETS_MASTER_KEY: undefined }, keyFile: fakeKeyFile(undefined, { unreadable: true }).store });
  assert.equal((await unreadable.service.getOverview()).masterKey, "invalid");
  await assert.rejects(unreadable.service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword }), (error: SecretsError) => error.code === "MASTER_KEY_INVALID" && /Không đọc được tệp khóa chủ/.test(error.message));

  const cannotWrite = setup({ env: { SECRETS_MASTER_KEY: undefined }, keyFile: fakeKeyFile(undefined, { createFails: true }).store });
  await assert.rejects(cannotWrite.service.createMasterKey({ userId: "u1", password: goodPassword }), (error: SecretsError) => error.code === "KEY_FILE_UNAVAILABLE" && !error.message.includes("EACCES"));
  assert.equal(cannotWrite.calls.masterKeyCreated.length, 0);

  const noFileSupport = setup({ env: { SECRETS_MASTER_KEY: undefined } });
  assert.equal((await noFileSupport.service.getOverview()).canCreateMasterKey, false);
  await assert.rejects(noFileSupport.service.createMasterKey({ userId: "u1", password: goodPassword }), (error: SecretsError) => error.code === "KEY_FILE_UNAVAILABLE");
});

test("Tệp khóa chủ thật trên đĩa: tạo 32 byte base64 hợp lệ, quyền 0600, không ghi đè, SECRETS_KEY_FILE đổi đường dẫn", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "iorder-keyfile-"));
  try {
    const target = path.join(dir, "con", "master.key");
    const store = createKeyFileStore(target);
    assert.equal(await store.read(), undefined, "chưa có tệp");
    await store.create();
    const text = (await readFile(target, "utf8")).trim();
    assert.equal(parseMasterKey(text).length, 32, "khóa tạo ra là khóa chủ hợp lệ");
    assert.equal(await store.read(), text);
    if (process.platform !== "win32") assert.equal((await stat(target)).mode & 0o777, 0o600, "chỉ chủ tệp đọc/ghi");
    await assert.rejects(store.create(), MasterKeyFileExistsError);
    assert.equal(await store.read(), text, "tạo lần hai không đụng vào khóa cũ");
    const second = createKeyFileStore(path.join(dir, "khac.key"));
    await second.create();
    assert.notEqual(await second.read(), text, "mỗi lần tạo một khóa ngẫu nhiên khác");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  assert.equal(resolveKeyFilePath({ SECRETS_KEY_FILE: "/data/secrets/master.key" }, "/app"), path.resolve("/data/secrets/master.key"));
  assert.equal(resolveKeyFilePath({}, "/app"), path.join("/app", ".data", "secrets-master.key"));
  assert.equal(resolveKeyFilePath({ SECRETS_KEY_FILE: "   " }, "/app"), path.join("/app", ".data", "secrets-master.key"));
});

test("Nhận biết bảng chưa tồn tại (migration 0025 chưa chạy): lỗi PostgreSQL 42P01 trực tiếp hoặc bọc trong cause của Drizzle; lỗi khác thì không", () => {
  assert.equal(isMissingTableError({ code: "42P01" }), true);
  assert.equal(isMissingTableError(Object.assign(new Error("Failed query"), { cause: { code: "42P01" } })), true);
  for (const other of [{ code: "23505" }, { cause: { code: "08006" } }, new Error("42P01"), null, undefined, "42P01"]) assert.equal(isMissingTableError(other), false, String(other));
});

test("Thuộc tính Search Console không bí mật nên gợi ý chính là giá trị; khóa bí mật không bao giờ lộ giá trị", async () => {
  const { service } = setup();
  const property = await service.setSecret({ userId: "u1", key: "search_console_property", value: "sc-domain:iorder.com.vn", password: goodPassword });
  assert.deepEqual([property.exposeValue, property.hint], [true, "sc-domain:iorder.com.vn"]);
  const key = await service.setSecret({ userId: "u1", key: "umami_api_key", value: umami, password: goodPassword });
  assert.deepEqual([key.exposeValue, key.hint === umami], [false, false]);
});
