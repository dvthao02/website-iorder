import assert from "node:assert/strict";
import test from "node:test";

import type { BackupStatus } from "../backup/backup-status";
import { summarizeJobMessage } from "./job-runs";
import { createSystemStatusService, systemJobDefinitions, type SystemStatusDependencies } from "./system-status.service";
import type { JobRun, SystemJobName } from "./system-status.contract";

const secret = "bi-mat-khong-duoc-lo-abc123";
const connectionString = "postgres://iorder:mat-khau-that@db.noi-bo:5432/iorder";
const now = Date.parse("2026-11-19T10:00:00Z");

const okBackup: BackupStatus = { state: "ok", lastSuccess: { finishedAt: new Date("2026-11-19T02:30:00Z"), source: "vps", databaseBytes: 1000, verified: true, users: 3, mediaAssets: 10 } as BackupStatus["lastSuccess"], lastFailure: null };

type Overrides = Partial<Omit<SystemStatusDependencies, "host" | "env">> & { host?: Partial<SystemStatusDependencies["host"]>; env?: Record<string, string | undefined>; clock?: { time: number } };

function setup(overrides: Overrides = {}) {
  const logs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  const calls = { database: 0, fetch: [] as string[] };
  const clock = overrides.clock ?? { time: now };
  const dependencies: SystemStatusDependencies = {
    now: () => new Date(clock.time),
    monotonic: overrides.monotonic ?? (() => 0),
    env: { NODE_ENV: "development", PUBLISH_WEB_REVALIDATE_URL: "http://website:3000/api/internal/revalidate", PUBLISH_WEB_REVALIDATE_SECRET: secret, ...overrides.env },
    fetch: overrides.fetch ?? (async (input) => { calls.fetch.push(String(input)); return new Response("{}", { status: 200 }); }),
    queryDatabase: overrides.queryDatabase ?? (async () => { calls.database += 1; return { version: "PostgreSQL 17.2 (Debian 17.2-1) on x86_64-pc-linux-gnu", sizeBytes: 123_456_789, connectionsUsed: 5, connectionsMax: 100 }; }),
    queryMigrations: overrides.queryMigrations ?? (async () => ({ applied: 25, lastAppliedAt: new Date("2026-11-19T01:00:00Z") })),
    expectedMigrations: overrides.expectedMigrations ?? (async () => 25),
    pingStorage: overrides.pingStorage ?? (async () => undefined),
    analyticsConnection: overrides.analyticsConnection ?? (async () => "connected"),
    searchConsoleConnection: overrides.searchConsoleConnection ?? (async () => "connected"),
    backup: overrides.backup ?? (async () => okBackup),
    jobRuns: overrides.jobRuns ?? (async () => ({})),
    publishing: overrides.publishing ?? (async () => ({ siteUrl: "https://iorder.vn", allowSearchIndexing: true })),
    cmsSecrets: overrides.cmsSecrets ?? (async () => ({ masterKey: "ok" as const, configured: { google_service_account: false, umami_api_key: false } })),
    host: {
      uptimeSeconds: () => 3 * 86_400, totalMemoryBytes: () => 8_000_000_000, availableMemoryBytes: () => 4_000_000_000, processMemoryBytes: () => 300_000_000,
      loadAverage: () => [0.5, 0.4, 0.3], cpuCount: () => 4, nodeVersion: "v24.0.0", platform: "linux",
      disk: async () => ({ totalBytes: 100_000_000_000, freeBytes: 60_000_000_000 }),
      ...overrides.host,
    },
    log: (message, context) => { logs.push({ message, context }); },
    timeoutMilliseconds: overrides.timeoutMilliseconds,
  };
  return { service: createSystemStatusService(dependencies), logs, calls, clock };
}

const run = (hoursAgo: number, ok = true, summary = "Đã dọn 3 bucket."): JobRun => ({ finishedAt: new Date(now - hoursAgo * 3_600_000).toISOString(), ok, summary });

test("Mọi thứ ổn: tình trạng chung ổn, database nêu phiên bản/dung lượng/kết nối, migration khớp mã nguồn, website được hỏi đúng /api/health", async () => {
  const { service, calls } = setup({ jobRuns: async () => ({ "login-throttles": run(5) }) });
  const status = await service.getStatus();
  assert.equal(status.overall, "ok");
  assert.equal(status.services.database.state, "ok");
  assert.equal(status.services.database.version, "PostgreSQL 17.2");
  assert.deepEqual(status.services.database.connections, { used: 5, max: 100 });
  assert.equal(status.services.database.sizeBytes, 123_456_789);
  assert.equal(status.services.migrations.state, "ok");
  assert.equal(status.services.migrations.expected, 25);
  assert.equal(status.services.storage.state, "ok");
  assert.equal(status.services.website.state, "ok");
  assert.deepEqual(calls.fetch, ["http://website:3000/api/health"], "chỉ gọi /api/health trên cùng máy với địa chỉ làm mới");
  assert.equal(status.backup.state, "ok");
  assert.equal(status.backup.lastSuccessAt, "2026-11-19T02:30:00.000Z");
  assert.equal(status.checkedAt, new Date(now).toISOString());
  assert.equal(status.counts.error, 0);
});

test("Database hỏng: trạng thái error và tình trạng chung error, thông báo chung, chi tiết kỹ thuật chỉ ghi log, không lộ chuỗi kết nối", async () => {
  const { service, logs } = setup({ queryDatabase: async () => { throw new Error(`connect ECONNREFUSED ${connectionString}`); } });
  const status = await service.getStatus();
  assert.equal(status.services.database.state, "error");
  assert.equal(status.overall, "error");
  assert.ok(!JSON.stringify(status).includes("mat-khau-that") && !JSON.stringify(status).includes("db.noi-bo"), "phản hồi không chứa chuỗi kết nối");
  assert.ok(logs.some((entry) => /database/.test(entry.message)), "lỗi được ghi log phía máy chủ");
});

test("Database chậm hoặc gần hết kết nối: cảnh báo; quá thời gian chờ coi như lỗi", async () => {
  let tick = 0;
  const slow = (await setup({ monotonic: () => tick, queryDatabase: async () => { tick = 1_500; return { version: "PostgreSQL 17.2", sizeBytes: 1, connectionsUsed: 1, connectionsMax: 100 }; } }).service.getStatus()).services.database;
  assert.equal(slow.state, "warn");
  assert.ok(slow.summary.includes("chậm (1500 ms)"), slow.summary);
  const crowded = await setup({ queryDatabase: async () => ({ version: "PostgreSQL 17.2", sizeBytes: 1, connectionsUsed: 85, connectionsMax: 100 }) }).service.getStatus();
  assert.equal(crowded.services.database.state, "warn");
  assert.match(crowded.services.database.summary, /85\/100/);
  assert.equal(crowded.overall, "warn");

  const hanging = await setup({ queryDatabase: () => new Promise(() => undefined), timeoutMilliseconds: 20 }).service.getStatus();
  assert.equal(hanging.services.database.state, "error");
});

test("Migration: thiếu so với mã nguồn thì cảnh báo; không đọc được bảng thì trung tính; không có journal thì chỉ nêu số đã áp dụng", async () => {
  const pending = (await setup({ queryMigrations: async () => ({ applied: 23, lastAppliedAt: null }) }).service.getStatus()).services.migrations;
  assert.equal(pending.state, "warn");
  assert.match(pending.summary, /Còn 2 migration chưa áp dụng \(23\/25\)/);
  const missing = (await setup({ queryMigrations: async () => null }).service.getStatus()).services.migrations;
  assert.equal(missing.state, "unknown");
  const noJournal = (await setup({ expectedMigrations: async () => null }).service.getStatus()).services.migrations;
  assert.equal(noJournal.state, "ok");
  assert.match(noJournal.summary, /Đã áp dụng 25 migration\./);
});

test("Website: chưa có địa chỉ thì trung tính; HTTP lỗi hoặc không kết nối được thì error", async () => {
  assert.equal((await setup({ env: { PUBLISH_WEB_REVALIDATE_URL: "" } }).service.getStatus()).services.website.state, "unknown");
  const http503 = (await setup({ fetch: async () => new Response("{}", { status: 503 }) }).service.getStatus()).services.website;
  assert.equal(http503.state, "error");
  assert.match(http503.summary, /503/);
  const down = await setup({ fetch: async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:3000"); } }).service.getStatus();
  assert.equal(down.services.website.state, "error");
  assert.equal(down.overall, "error");
  assert.ok(!JSON.stringify(down).includes("10.0.0.5"));
  const invalid = (await setup({ env: { PUBLISH_WEB_REVALIDATE_URL: "khong-phai-url" } }).service.getStatus()).services.website;
  assert.equal(invalid.state, "warn");
});

test("Kho tệp lỗi thì error; tích hợp tùy chọn: chưa bật là trung tính (không phải lỗi), đang lỗi chỉ là cảnh báo", async () => {
  const storage = await setup({ pingStorage: async () => { throw new Error("AccessDenied"); } }).service.getStatus();
  assert.equal(storage.services.storage.state, "error");
  assert.equal(storage.overall, "error");
  const off = await setup({ analyticsConnection: async () => "not_configured", searchConsoleConnection: async () => "not_configured" }).service.getStatus();
  assert.equal(off.services.analytics.state, "unknown");
  assert.equal(off.services.searchConsole.state, "unknown");
  assert.equal(off.overall, "ok", "chưa nối Umami/Search Console không làm hệ thống mất ổn định");
  const broken = await setup({ analyticsConnection: async () => "error", searchConsoleConnection: async () => { throw new Error("boom"); } }).service.getStatus();
  assert.equal(broken.services.analytics.state, "warn");
  assert.equal(broken.services.searchConsole.state, "warn");
  assert.equal(broken.overall, "warn");
});

test("Sao lưu: ổn / quá hạn / lỗi / chưa có ánh xạ đúng sang trạng thái; không đọc được thì trung tính", async () => {
  const stateOf = async (backup: BackupStatus) => (await setup({ backup: async () => backup }).service.getStatus()).backup.state;
  assert.equal(await stateOf(okBackup), "ok");
  assert.equal(await stateOf({ ...okBackup, state: "stale" }), "warn");
  assert.equal(await stateOf({ state: "failed", lastSuccess: null, lastFailure: { failedAt: new Date("2026-11-19T02:30:00Z"), message: "x" } as BackupStatus["lastFailure"] }), "error");
  assert.equal(await stateOf({ state: "never", lastSuccess: null, lastFailure: null }), "warn");
  assert.equal((await setup({ backup: async () => { throw new Error("db"); } }).service.getStatus()).backup.state, "unknown");
});

test("Tác vụ định kỳ: chưa chạy là trung tính; lỗi lần gần nhất và quá hạn (chỉ tác vụ có lịch) là cảnh báo; tác vụ chạy tay không bao giờ quá hạn", async () => {
  const runs: Partial<Record<SystemJobName, JobRun>> = { "login-throttles": run(30), "media-cleanup": run(24 * 90), "content-cleanup": run(2, false, "Không thể dọn nội dung đã xóa.") };
  const jobs = (await setup({ jobRuns: async () => runs }).service.getStatus()).jobs;
  const byName = Object.fromEntries(jobs.map((job) => [job.name, job]));
  assert.equal(byName["login-throttles"].state, "ok");
  assert.equal(byName["media-cleanup"].state, "ok", "chạy tay: 90 ngày trước vẫn không bị coi là quá hạn");
  assert.equal(byName["content-cleanup"].state, "warn");
  assert.match(byName["content-cleanup"].summary, /bị lỗi/);
  assert.equal(byName["login-throttles"].schedule, systemJobDefinitions["login-throttles"].schedule);

  const stale = (await setup({ jobRuns: async () => ({ "login-throttles": run(40) }) }).service.getStatus()).jobs.find((job) => job.name === "login-throttles")!;
  assert.equal(stale.state, "warn");
  assert.match(stale.summary, /36 giờ/);
  const never = (await setup().service.getStatus()).jobs;
  assert.ok(never.every((job) => job.state === "unknown"));
  const unreadable = (await setup({ jobRuns: async () => { throw new Error("db"); } }).service.getStatus()).jobs;
  assert.ok(unreadable.every((job) => job.state === "unknown"));
});

test("Máy chủ: ổ đĩa gần đầy là error, thấp là warn; Windows không hiện load average; có số đo bộ nhớ và thời gian chạy", async () => {
  const lowDisk = (await setup({ host: { disk: async () => ({ totalBytes: 100, freeBytes: 12 }) } }).service.getStatus()).server;
  assert.equal(lowDisk.state, "warn");
  assert.match(lowDisk.summary, /ổ đĩa còn 12% trống/);
  const fullDisk = await setup({ host: { disk: async () => ({ totalBytes: 100, freeBytes: 3 }) } }).service.getStatus();
  assert.equal(fullDisk.server.state, "error");
  assert.equal(fullDisk.overall, "error");
  const lowMemory = (await setup({ host: { availableMemoryBytes: () => 200_000_000 } }).service.getStatus()).server;
  assert.equal(lowMemory.state, "warn");
  const windows = (await setup({ host: { platform: "win32" } }).service.getStatus()).server;
  assert.equal("loadAverage" in windows, false);
  const linux = (await setup().service.getStatus()).server;
  assert.deepEqual(linux.loadAverage, [0.5, 0.4, 0.3]);
  assert.equal(linux.uptimeSeconds, 3 * 86_400);
  assert.deepEqual(linux.memory, { totalBytes: 8_000_000_000, freeBytes: 4_000_000_000, processBytes: 300_000_000 });
  assert.equal(linux.disk?.freeBytes, 60_000_000_000);
  const noDisk = (await setup({ host: { disk: async () => { throw new Error("statfs"); } } }).service.getStatus()).server;
  assert.equal(noDisk.disk, undefined);
});

test("Cấu hình: chỉ báo đã đặt/chưa đặt, không bao giờ có giá trị; production thiếu mục bắt buộc thì cảnh báo", async () => {
  const dev = await setup().service.getStatus();
  assert.equal(dev.config.find((item) => item.key === "revalidate-secret")?.ok, true);
  assert.equal(dev.config.every((item) => !item.required || item.ok), true);
  assert.ok(!JSON.stringify(dev).includes(secret), "giá trị khóa không xuất hiện trong phản hồi");

  const prod = await setup({ env: { NODE_ENV: "production", PUBLISH_WEB_REVALIDATE_SECRET: "", PUBLISH_WEB_REVALIDATE_URL: "", GOOGLE_SERVICE_ACCOUNT_JSON: secret }, publishing: async () => ({ siteUrl: null, allowSearchIndexing: false }) }).service.getStatus();
  const missing = prod.config.filter((item) => item.required && !item.ok).map((item) => item.key);
  assert.deepEqual(missing, ["revalidate-secret", "revalidate-url", "site-url"]);
  assert.equal(prod.overall, "warn");
  assert.equal(prod.config.find((item) => item.key === "search-console")?.ok, true);
  assert.ok(!JSON.stringify(prod).includes(secret));
  assert.equal(prod.config.find((item) => item.key === "indexing")?.ok, false);
});

test("Khóa API nhập ở CMS được tính là đã cấu hình; khóa chủ thiếu hoặc sai được báo nhưng không bắt buộc", async () => {
  const none = (await setup().service.getStatus()).config;
  assert.equal(none.find((item) => item.key === "search-console")?.ok, false);
  assert.equal(none.find((item) => item.key === "secrets-master-key")?.ok, true);

  const stored = (await setup({ cmsSecrets: async () => ({ masterKey: "ok", configured: { google_service_account: true, umami_api_key: true } }), env: { UMAMI_API_URL: "http://umami:3000", UMAMI_WEBSITE_ID: "ma-website" } }).service.getStatus()).config;
  assert.equal(stored.find((item) => item.key === "search-console")?.ok, true, "khóa Google ở CMS");
  assert.equal(stored.find((item) => item.key === "analytics")?.ok, true, "API key Umami ở CMS cộng với địa chỉ và mã website ở máy chủ");
  const allInCms = (await setup({ cmsSecrets: async () => ({ masterKey: "ok", configured: { google_service_account: false, umami_api_key: true, umami_api_url: true, umami_website_id: true } }), env: {} }).service.getStatus()).config;
  assert.equal(allInCms.find((item) => item.key === "analytics")?.ok, true, "địa chỉ, mã website và API key đều nhập ở CMS");
  const missingId = (await setup({ cmsSecrets: async () => ({ masterKey: "ok", configured: { google_service_account: false, umami_api_key: true, umami_api_url: true, umami_website_id: false } }), env: {} }).service.getStatus()).config;
  assert.equal(missingId.find((item) => item.key === "analytics")?.ok, false, "thiếu mã website thì chưa nối");
  const noWebsite = (await setup({ cmsSecrets: async () => ({ masterKey: "ok", configured: { google_service_account: false, umami_api_key: true } }) }).service.getStatus()).config;
  assert.equal(noWebsite.find((item) => item.key === "analytics")?.ok, false, "thiếu địa chỉ/mã website thì chưa đủ");

  const missingMaster = await setup({ cmsSecrets: async () => ({ masterKey: "missing", configured: { google_service_account: false, umami_api_key: false } }), env: { NODE_ENV: "production", PUBLISH_WEB_REVALIDATE_SECRET: "x", PUBLISH_WEB_REVALIDATE_URL: "http://website:3000/api/internal/revalidate" } }).service.getStatus();
  const master = missingMaster.config.find((item) => item.key === "secrets-master-key")!;
  assert.deepEqual([master.ok, master.required], [false, false]);
  assert.match(master.hint ?? "", /Chưa đặt thì không lưu được/);
  const invalidMaster = (await setup({ cmsSecrets: async () => ({ masterKey: "invalid", configured: { google_service_account: false, umami_api_key: false } }) }).service.getStatus()).config.find((item) => item.key === "secrets-master-key")!;
  assert.match(invalidMaster.hint ?? "", /sai định dạng/);
  assert.equal((await setup({ cmsSecrets: async () => { throw new Error("db"); } }).service.getStatus()).config.some((item) => item.key === "secrets-master-key"), true, "không đọc được kho khóa thì vẫn dựng được màn");
});

test("Mã phiên bản: chỉ nhận chuỗi ngắn an toàn; không hợp lệ thì bỏ", async () => {
  assert.equal((await setup({ env: { APP_COMMIT: "a1b2c3d" } }).service.getStatus()).app.commit, "a1b2c3d");
  assert.equal((await setup({ env: { APP_COMMIT: "abc; rm -rf /" } }).service.getStatus()).app.commit, null);
  assert.equal((await setup({ env: { APP_COMMIT: "x".repeat(41) } }).service.getStatus()).app.commit, null);
  assert.equal((await setup().service.getStatus()).app.commit, null);
  const app = (await setup({ env: { NODE_ENV: "production", SERVICE_NAME: "api" } }).service.getStatus()).app;
  assert.deepEqual([app.environment, app.service], ["production", "api"]);
});

test("Nhớ kết quả vài giây và gộp các lần gọi cùng lúc; hết hạn thì kiểm tra lại", async () => {
  const { service, calls, clock } = setup();
  const [first, second] = await Promise.all([service.getStatus(), service.getStatus()]);
  assert.equal(first, second);
  assert.equal(calls.database, 1);
  await service.getStatus();
  assert.equal(calls.database, 1, "trong vài giây dùng lại kết quả");
  clock.time += 6_000;
  await service.getStatus();
  assert.equal(calls.database, 2);
  await service.getStatus({ fresh: true });
  assert.equal(calls.database, 3, "fresh bỏ qua bộ nhớ đệm");
});

test("Thông điệp tác vụ định kỳ: gộp xuống một dòng, tối đa 300 ký tự", () => {
  assert.equal(summarizeJobMessage("  Đã dọn\n  3   bucket  "), "Đã dọn 3 bucket");
  const long = summarizeJobMessage("x".repeat(500));
  assert.equal(long.length, 298, "297 ký tự + dấu …");
  assert.ok(long.endsWith("…"));
});
