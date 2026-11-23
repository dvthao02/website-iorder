import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { createTokenProvider, GoogleAuthError, googleTokenUrl, parseServiceAccountKey, searchConsoleScope, signServiceAccountJwt } from "./google-auth";
import { searchConsolePagePathSchema } from "./search-console.contract";
import { buildOpportunities, createSearchConsoleService, explainError, pickProperty, searchConsolePeriod, type SearchConsoleDependencies } from "./search-console.service";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const email = "cms@du-an.iam.gserviceaccount.com";
const keyJson = JSON.stringify({ type: "service_account", client_email: email, private_key: privateKey });
const accessToken = "ya29.token-bi-mat-khong-duoc-lo";

type Call = { url: string; method: string; headers: Record<string, string>; body: string };

// Máy chủ Google giả: đổi mã, danh sách website, truy vấn Search Analytics. `handler` tùy chỉnh phản hồi theo địa chỉ.
function fakeGoogle(handlers: { sites?: unknown; status?: Partial<Record<"token" | "sites" | "query", number>>; rows?: (body: Record<string, unknown>) => unknown } = {}) {
  const calls: Call[] = [];
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = init?.body ? String(init.body) : "";
    calls.push({ url, method: init?.method ?? "GET", headers, body });
    if (url === googleTokenUrl) return handlers.status?.token ? respond(handlers.status.token, { error: "invalid_grant" }) : respond(200, { access_token: accessToken, expires_in: 3600 });
    if (url.endsWith("/webmasters/v3/sites")) return handlers.status?.sites ? respond(handlers.status.sites, {}) : respond(200, handlers.sites ?? { siteEntry: [{ siteUrl: "sc-domain:iorder.vn", permissionLevel: "siteRestrictedUser" }] });
    if (url.includes("/searchAnalytics/query")) {
      if (handlers.status?.query) return respond(handlers.status.query, {});
      const parsed = JSON.parse(body) as Record<string, unknown>;
      return respond(200, handlers.rows ? handlers.rows(parsed) : parsed.dimensions ? { rows: [{ keys: ["phần mềm quản lý bán hàng"], clicks: 4, impressions: 800, ctr: 0.005, position: 12.4 }, { keys: ["máy in bếp"], clicks: 30, impressions: 200, ctr: 0.15, position: 2.1 }] } : { rows: [{ clicks: 34, impressions: 1000, ctr: 0.034, position: 9.2 }] });
    }
    return respond(404, {});
  }) as typeof fetch;
  return { fetcher, calls };
}

function setup(options: { env?: Record<string, string | undefined>; google?: ReturnType<typeof fakeGoogle>; siteUrl?: string | null; files?: Record<string, string>; cmsSecret?: SearchConsoleDependencies["cmsSecret"] } = {}) {
  const clock = { time: Date.parse("2026-11-19T05:00:00Z") };
  const google = options.google ?? fakeGoogle();
  const dependencies: SearchConsoleDependencies = {
    fetch: google.fetcher,
    env: options.env ?? { GOOGLE_SERVICE_ACCOUNT_JSON: keyJson },
    now: () => new Date(clock.time),
    readFile: async (path) => { const content = options.files?.[path]; if (content === undefined) throw new Error("ENOENT"); return content; },
    siteUrl: async () => options.siteUrl === undefined ? "https://iorder.vn" : options.siteUrl,
    cmsSecret: options.cmsSecret,
  };
  return { service: createSearchConsoleService(dependencies), google, clock };
}

test("Đọc khóa JSON: hợp lệ thì lấy email và khóa riêng; sai thì báo lỗi chung, không lặp lại nội dung đã đọc", () => {
  assert.deepEqual(parseServiceAccountKey(keyJson), { clientEmail: email, privateKey });
  for (const bad of ["không phải json với private_key BEGIN PRIVATE KEY bí mật", JSON.stringify({ client_email: email }), JSON.stringify({ client_email: "", private_key: privateKey }), JSON.stringify({ client_email: email, private_key: "khong-phai-khoa" }), "null", "[]"]) {
    assert.throws(() => parseServiceAccountKey(bad), (error: Error) => /Khóa tài khoản dịch vụ/.test(error.message) && !error.message.includes("bí mật") && !error.message.includes("khong-phai-khoa"), bad);
  }
});

test("JWT: header RS256, scope chỉ đọc, aud là máy chủ đổi mã của Google, hiệu lực 1 giờ, chữ ký đúng", () => {
  const jwt = signServiceAccountJwt({ clientEmail: email, privateKey }, 1_000_000);
  const [header, claims, signature] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(claims, "base64url").toString()), { iss: email, scope: searchConsoleScope, aud: googleTokenUrl, iat: 1_000_000, exp: 1_003_600 });
  assert.equal(searchConsoleScope, "https://www.googleapis.com/auth/webmasters.readonly");
  assert.equal(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url")), true);
  assert.equal(createVerify("RSA-SHA256").update(`${header}.${claims}x`).verify(publicKey, Buffer.from(signature, "base64url")), false);
});

test("Mã truy cập: gửi JWT bearer, dùng lại khi còn hạn, làm mới khi sắp hết, nhiều yêu cầu cùng lúc chỉ đổi một lần", async () => {
  const google = fakeGoogle();
  let time = Date.parse("2026-11-19T00:00:00Z");
  const getToken = createTokenProvider({ fetch: google.fetcher, now: () => new Date(time), key: { clientEmail: email, privateKey } });
  const [first, second] = await Promise.all([getToken(), getToken()]);
  assert.deepEqual([first, second], [accessToken, accessToken]);
  assert.equal(google.calls.length, 1);
  const form = new URLSearchParams(google.calls[0].body);
  assert.equal(google.calls[0].url, googleTokenUrl);
  assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  assert.equal(form.get("assertion")?.split(".").length, 3);
  time += 30 * 60_000;
  await getToken();
  assert.equal(google.calls.length, 1, "còn hạn 30 phút nữa thì dùng lại");
  time += 31 * 60_000;
  await getToken();
  assert.equal(google.calls.length, 2, "còn dưới 1 phút thì làm mới");
});

test("Google từ chối khóa: lỗi dễ hiểu, không chứa JWT hay khóa", async () => {
  const getToken = createTokenProvider({ fetch: fakeGoogle({ status: { token: 400 } }).fetcher, now: () => new Date(), key: { clientEmail: email, privateKey } });
  await assert.rejects(getToken(), (error: Error) => error instanceof GoogleAuthError && /HTTP 400/.test(error.message) && !error.message.includes("PRIVATE KEY") && !/eyJ/.test(error.message));
});

test("28 ngày gần nhất có dữ liệu: kết thúc cách hôm nay 3 ngày (giờ Việt Nam)", () => {
  assert.deepEqual(searchConsolePeriod(new Date("2026-11-19T05:00:00Z")), { startDate: "2026-10-20", endDate: "2026-11-16" });
  // 23h UTC đã sang ngày hôm sau ở Việt Nam.
  assert.deepEqual(searchConsolePeriod(new Date("2026-11-19T20:00:00Z")), { startDate: "2026-10-21", endDate: "2026-11-17" });
});

test("Cơ hội: hạng 8–20 nhiều lượt hiện, hoặc trang đầu nhưng ít người bấm; sắp theo lượt hiện, tối đa 10", () => {
  const row = (query: string, impressions: number, position: number, ctr: number) => ({ query, clicks: Math.round(impressions * ctr), impressions, ctr, position });
  const result = buildOpportunities([
    row("gần trang đầu", 500, 12, 0.01), row("quá ít lượt hiện", 5, 12, 0.01), row("đã top 3 và nhiều click", 900, 2, 0.2),
    row("trang đầu ít bấm", 700, 5, 0.01), row("trang đầu ít lượt hiện", 20, 5, 0.01), row("quá xa", 800, 35, 0.001), row("hạng 7,9 nhiều bấm", 300, 7.9, 0.1),
  ]);
  assert.deepEqual(result.map((item) => [item.query, item.reason]), [["trang đầu ít bấm", "low_ctr"], ["gần trang đầu", "near_page_one"]]);
  assert.equal(buildOpportunities(Array.from({ length: 30 }, (_, index) => row(`q${index}`, 100 + index, 10, 0.01))).length, 10);
});

test("Chọn thuộc tính: ưu tiên Tên miền, rồi https, rồi www; bỏ website chưa xác minh; không khớp thì undefined", () => {
  const entries = (...urls: string[]) => urls.map((siteUrl) => ({ siteUrl, permissionLevel: "siteRestrictedUser" }));
  assert.equal(pickProperty(entries("https://iorder.vn/", "sc-domain:iorder.vn"), "https://iorder.vn"), "sc-domain:iorder.vn");
  assert.equal(pickProperty(entries("https://www.iorder.vn/", "https://iorder.vn/"), "https://iorder.vn"), "https://iorder.vn/");
  assert.equal(pickProperty(entries("https://www.iorder.vn/"), "https://iorder.vn"), "https://www.iorder.vn/");
  assert.equal(pickProperty(entries("sc-domain:iorder.vn"), "https://www.iorder.vn/pages"), "sc-domain:iorder.vn");
  assert.equal(pickProperty([{ siteUrl: "sc-domain:iorder.vn", permissionLevel: "siteUnverifiedUser" }], "https://iorder.vn"), undefined);
  assert.equal(pickProperty(entries("sc-domain:khac.vn"), "https://iorder.vn"), undefined);
  assert.equal(pickProperty(entries("sc-domain:iorder.vn"), null), undefined);
  assert.equal(pickProperty(entries("sc-domain:iorder.vn"), "không-phải-url"), undefined);
});

test("Chưa có khóa: not_configured và không gọi ra ngoài", async () => {
  const { service, google } = setup({ env: {} });
  assert.deepEqual(await service.getOverview(), { connection: "not_configured" });
  assert.deepEqual(await service.getPageQueries("/news/bai"), { connection: "not_configured" });
  assert.deepEqual(await service.diagnose(), { configured: false });
  assert.equal(google.calls.length, 0);
});

test("Tổng quan: gọi đúng địa chỉ, tiêu đề và nội dung; cụm hay gõ sắp theo lượt bấm; kết quả được nhớ vài giờ", async () => {
  const { service, google, clock } = setup();
  const overview = await service.getOverview();
  assert.equal(overview.connection, "connected");
  if (overview.connection !== "connected") return;
  assert.equal(overview.property, "sc-domain:iorder.vn");
  assert.deepEqual(overview.period, { startDate: "2026-10-20", endDate: "2026-11-16" });
  assert.deepEqual(overview.totals, { clicks: 34, impressions: 1000, ctr: 0.034, position: 9.2 });
  assert.deepEqual(overview.topQueries.map((item) => item.query), ["máy in bếp", "phần mềm quản lý bán hàng"]);
  assert.deepEqual(overview.opportunities.map((item) => [item.query, item.reason]), [["phần mềm quản lý bán hàng", "near_page_one"]]);
  const queryCalls = google.calls.filter((call) => call.url.includes("/searchAnalytics/query"));
  assert.equal(queryCalls.length, 2);
  assert.ok(queryCalls.every((call) => call.url === "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aiorder.vn/searchAnalytics/query" && call.method === "POST" && call.headers.authorization === `Bearer ${accessToken}`));
  assert.deepEqual(JSON.parse(queryCalls[1].body), { startDate: "2026-10-20", endDate: "2026-11-16", dimensions: ["query"], rowLimit: 250 });
  // Gọi lại ngay: lấy từ bộ nhớ, không gọi Google nữa; sau 7 giờ thì làm mới.
  const callsBefore = google.calls.length;
  await service.getOverview();
  assert.equal(google.calls.length, callsBefore);
  clock.time += 7 * 3_600_000;
  await service.getOverview();
  assert.ok(google.calls.length > callsBefore);
});

test("SEARCH_CONSOLE_PROPERTY đặt sẵn thì không dò danh sách website", async () => {
  const { service, google } = setup({ env: { GOOGLE_SERVICE_ACCOUNT_JSON: keyJson, SEARCH_CONSOLE_PROPERTY: "https://iorder.vn/" } });
  const overview = await service.getOverview();
  assert.equal(overview.connection === "connected" && overview.property, "https://iorder.vn/");
  assert.ok(!google.calls.some((call) => call.url.endsWith("/webmasters/v3/sites")));
  assert.ok(google.calls.some((call) => call.url.includes("/sites/https%3A%2F%2Fiorder.vn%2F/searchAnalytics/query")));
});

test("Khóa đọc từ tệp (GOOGLE_SERVICE_ACCOUNT_FILE); tệp sai đường dẫn hoặc sai nội dung báo lỗi cấu hình rõ ràng, không lộ nội dung", async () => {
  const ok = setup({ env: { GOOGLE_SERVICE_ACCOUNT_FILE: "/bi-mat/khoa.json" }, files: { "/bi-mat/khoa.json": keyJson } });
  assert.equal((await ok.service.getOverview()).connection, "connected");
  const missing = await setup({ env: { GOOGLE_SERVICE_ACCOUNT_FILE: "/khong-co.json" } }).service.getOverview();
  assert.equal(missing.connection, "error");
  assert.match(missing.connection === "error" ? missing.message : "", /GOOGLE_SERVICE_ACCOUNT_FILE/);
  const broken = await setup({ env: { GOOGLE_SERVICE_ACCOUNT_FILE: "/hong.json" }, files: { "/hong.json": "{ hỏng NOI-DUNG-BI-MAT" } }).service.getOverview();
  assert.equal(broken.connection, "error");
  assert.ok(!JSON.stringify(broken).includes("NOI-DUNG-BI-MAT"));
});

test("Google báo 403: lời nhắc thêm đúng email vào Search Console; không có mã truy cập hay khóa trong kết quả", async () => {
  const { service } = setup({ google: fakeGoogle({ status: { sites: 403 } }) });
  const result = await service.getOverview();
  assert.equal(result.connection, "error");
  const message = result.connection === "error" ? result.message : "";
  assert.ok(message.includes(email) && /Người dùng và quyền/.test(message));
  assert.ok(!JSON.stringify(result).includes(accessToken) && !JSON.stringify(result).includes("PRIVATE KEY"));
});

test("Tài khoản chưa thấy website nào hoặc không khớp: báo rõ; lỗi được nhớ 1 phút để không gọi dồn dập", async () => {
  const none = setup({ google: fakeGoogle({ sites: { siteEntry: [] } }) });
  const first = await none.service.getOverview();
  assert.match(first.connection === "error" ? first.message : "", /chưa thấy website nào/);
  const callsBefore = none.google.calls.length;
  await none.service.getOverview();
  assert.equal(none.google.calls.length, callsBefore);
  none.clock.time += 2 * 60_000;
  await none.service.getOverview();
  assert.ok(none.google.calls.length > callsBefore);
  const other = await setup({ google: fakeGoogle({ sites: { siteEntry: [{ siteUrl: "sc-domain:khac.vn" }] } }) }).service.getOverview();
  assert.match(other.connection === "error" ? other.message : "", /không có website nào khớp “iorder\.vn”/);
});

test("Google lỗi khi làm mới: dùng số liệu cũ đã có thay vì báo lỗi", async () => {
  let failing = false;
  const base = fakeGoogle();
  const google = { calls: base.calls, fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => failing && String(input).includes("/searchAnalytics/") ? new Response("{}", { status: 500 }) : base.fetcher(input, init)) as typeof fetch };
  const { service, clock } = setup({ google });
  assert.equal((await service.getOverview()).connection, "connected");
  failing = true;
  clock.time += 7 * 3_600_000;
  assert.equal((await service.getOverview()).connection, "connected");
});

test("Cụm của một trang: lọc đúng địa chỉ đầy đủ của trang, tối đa 10, sắp theo lượt hiện; thiếu địa chỉ website thì báo lỗi", async () => {
  const { service, google } = setup();
  const result = await service.getPageQueries("/news/ten-bai");
  assert.equal(result.connection, "connected");
  assert.deepEqual(result.connection === "connected" ? result.queries.map((item) => item.query) : [], ["phần mềm quản lý bán hàng", "máy in bếp"]);
  const body = JSON.parse(google.calls.filter((call) => call.url.includes("/searchAnalytics/query")).at(-1)!.body);
  assert.deepEqual(body.dimensionFilterGroups, [{ groupType: "and", filters: [{ dimension: "page", operator: "equals", expression: "https://iorder.vn/news/ten-bai" }] }]);
  assert.equal(body.rowLimit, 10);
  const missing = await setup({ siteUrl: null }).service.getPageQueries("/news/bai");
  assert.match(missing.connection === "error" ? missing.message : "", /Tên miền & SEO/);
});

test("Chẩn đoán: cấu hình đủ thì nêu email, các website tài khoản thấy và thuộc tính được chọn; thiếu quyền thì nói cách sửa", async () => {
  const ok = await setup().service.diagnose();
  assert.deepEqual([ok.configured, "email" in ok && ok.email, "property" in ok && ok.property, "sampleQueries" in ok && ok.sampleQueries], [true, email, "sc-domain:iorder.vn", 2]);
  const noAccess = await setup({ google: fakeGoogle({ sites: { siteEntry: [] } }) }).service.diagnose();
  assert.ok(noAccess.configured && "problem" in noAccess && noAccess.problem?.includes(email));
});

test("Chẩn đoán cho màn Cài đặt: nêu nguồn khóa và thuộc tính ép bằng biến, không bao giờ lộ khóa riêng hay mã truy cập, gộp các lần bấm cùng lúc", async () => {
  const fromJson = await setup().service.diagnose();
  assert.ok(fromJson.configured && fromJson.source === "json" && fromJson.propertyFromSetting === false && fromJson.websiteUrl === "https://iorder.vn");
  assert.deepEqual(fromJson.configured && fromJson.sites, [{ siteUrl: "sc-domain:iorder.vn", permissionLevel: "siteRestrictedUser" }]);

  const fromFile = await setup({ env: { GOOGLE_SERVICE_ACCOUNT_FILE: "D:/bi-mat/khoa.json", SEARCH_CONSOLE_PROPERTY: "https://iorder.com.vn/" }, files: { "D:/bi-mat/khoa.json": keyJson } }).service.diagnose();
  assert.ok(fromFile.configured && fromFile.source === "file" && fromFile.propertyFromSetting === true && fromFile.property === "https://iorder.com.vn/");

  // Tệp khóa không đọc được: vẫn nói rõ nguồn là tệp và cách sửa, không đoán là chưa cấu hình.
  const unreadable = await setup({ env: { GOOGLE_SERVICE_ACCOUNT_FILE: "D:/khong-co.json" } }).service.diagnose();
  assert.ok(unreadable.configured && unreadable.source === "file" && /GOOGLE_SERVICE_ACCOUNT_FILE/.test(unreadable.problem ?? ""));

  // Kết quả chẩn đoán đi thẳng ra trình duyệt: không được chứa khóa riêng, nội dung khóa hay mã truy cập.
  const serialized = JSON.stringify([fromJson, fromFile, unreadable]);
  for (const secret of [privateKey, "BEGIN PRIVATE KEY", accessToken, "private_key"]) assert.ok(!serialized.includes(secret), "lộ " + secret.slice(0, 20));

  const { service, google } = setup();
  const [first, second] = await Promise.all([service.diagnose(), service.diagnose()]);
  assert.equal(first, second);
  assert.equal(google.calls.filter((call) => call.url === googleTokenUrl).length, 1);
});

test("Khóa nhập ở CMS: dùng khi biến môi trường chưa đặt (nguồn cms), biến luôn thắng, đổi hoặc xóa khóa ở CMS thì số liệu đã nhớ được làm mới ngay", async () => {
  const stored: { google?: string; property?: string } = { google: keyJson };
  const cmsSecret: NonNullable<SearchConsoleDependencies["cmsSecret"]> = async (key) => key === "google_service_account" ? stored.google : stored.property;

  const { service, google } = setup({ env: {}, cmsSecret });
  assert.equal((await service.getOverview()).connection, "connected");
  const diagnosis = await service.diagnose();
  assert.ok(diagnosis.configured && diagnosis.source === "cms" && diagnosis.email === email && diagnosis.propertyFromSetting === false);
  const callsBefore = google.calls.length;
  await service.getOverview();
  assert.equal(google.calls.length, callsBefore, "kết quả được nhớ như bình thường");

  // Thuộc tính nhập ở CMS ép dùng đúng thuộc tính đó, không dò danh sách website.
  stored.property = "sc-domain:iorder.vn";
  const withProperty = await service.diagnose();
  assert.ok(withProperty.configured && withProperty.propertyFromSetting === true && withProperty.property === "sc-domain:iorder.vn");

  // Xóa khóa ở CMS: lần hỏi kế tiếp không còn dùng số liệu đã nhớ.
  stored.google = undefined;
  assert.equal((await service.getOverview()).connection, "not_configured");
  assert.deepEqual(await service.diagnose(), { configured: false });
  stored.google = keyJson;
  assert.equal((await service.getOverview()).connection, "connected");

  // Biến môi trường luôn thắng: khóa ở CMS không được đụng tới.
  const consulted: string[] = [];
  const envWins = setup({ env: { GOOGLE_SERVICE_ACCOUNT_JSON: keyJson }, cmsSecret: async (key) => { consulted.push(key); return "khoa-cms-khong-duoc-dung"; } });
  const envDiagnosis = await envWins.service.diagnose();
  assert.ok(envDiagnosis.configured && envDiagnosis.source === "json" && envDiagnosis.email === email);
  assert.equal((await envWins.service.getOverview()).connection, "connected");
  assert.ok(consulted.every((key) => key === "search_console_property"), "biến môi trường thắng: không bao giờ hỏi khóa ở CMS (chỉ có thể hỏi thuộc tính): " + consulted.join(","));

  // Khóa lưu ở CMS hỏng (ví dụ bị sửa tay trong database): báo lỗi cấu hình rõ ràng, không lộ nội dung.
  const broken = await setup({ env: {}, cmsSecret: async (key) => key === "google_service_account" ? "noi-dung-khoa-hong-bi-mat" : undefined }).service.diagnose();
  assert.ok(broken.configured && broken.source === "cms" && /Khóa tài khoản dịch vụ/.test(broken.problem ?? "") && !JSON.stringify(broken).includes("bi-mat"));
});

test("Đường dẫn trang gửi lên API: chỉ nhận đường dẫn tương đối an toàn", () => {
  for (const good of ["/", "/news/bai-viet-1", "/support/guides/cai-dat-may-in", "/software/ten%20san-pham"]) assert.equal(searchConsolePagePathSchema.safeParse(good).success, true, good);
  for (const bad of ["", "tin-tuc", "https://evil.example/", "//evil.example", "/a/../b", "/a//b", "/a?x=1", "/a#b", `/${"a".repeat(300)}`]) assert.equal(searchConsolePagePathSchema.safeParse(bad).success, false, bad);
});

test("Lời giải thích lỗi không bao giờ chứa nội dung lạ: lỗi không rõ chỉ báo chung", () => {
  assert.match(explainError(new Error("secret token ya29.xxx")), /Không lấy được dữ liệu/);
  assert.ok(!explainError(new Error("secret token ya29.xxx")).includes("ya29"));
});
