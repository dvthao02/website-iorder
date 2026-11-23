import assert from "node:assert/strict";
import test from "node:test";

import { createAnalyticsService } from "./analytics.service";

const websiteId = "12345678-1234-4123-8123-123456789012";
const env = { UMAMI_API_URL: "http://umami:3000/", UMAMI_API_KEY: "umami_khoa_thu", UMAMI_WEBSITE_ID: websiteId };
// 16/10/2026 10:00 giờ Việt Nam.
const now = () => new Date("2026-10-16T03:00:00Z");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("Chưa cấu hình Umami (hoặc mã website sai) thì không gọi mạng", async () => {
  const fetcher = () => { throw new Error("không được gọi"); };
  for (const partial of [{}, { ...env, UMAMI_API_KEY: "" }, { ...env, UMAMI_WEBSITE_ID: "khong-phai-uuid" }]) {
    const service = createAnalyticsService({ fetch: fetcher as typeof fetch, env: partial, now });
    assert.deepEqual(await service.getAnalyticsOverview(), { connection: "not_connected", periodDays: 7 });
  }
});

test("API key nhập ở CMS: dùng khi UMAMI_API_KEY chưa đặt, biến môi trường luôn thắng, CMS lỗi thì coi như chưa nối", async () => {
  const seen: Array<string | null> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Headers(init?.headers).get("authorization"));
    const url = new URL(String(input));
    if (url.pathname.endsWith("/stats")) return json({ pageviews: 1, visitors: 1, visits: 1, bounces: 0, totaltime: 10, comparison: { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 } });
    if (url.pathname.endsWith("/pageviews")) return json({ pageviews: [], sessions: [] });
    return json([]);
  };
  const withoutKey = { UMAMI_API_URL: env.UMAMI_API_URL, UMAMI_WEBSITE_ID: websiteId };

  const fromCms = await createAnalyticsService({ fetch: fetcher as typeof fetch, env: withoutKey, now, cmsSecret: async (key) => key === "umami_api_key" ? "umami_khoa_o_cms" : undefined }).getAnalyticsOverview();
  assert.equal(fromCms.connection, "connected");
  assert.ok(seen.length > 0);
  assert.equal(seen.filter((value) => value !== "Bearer umami_khoa_o_cms").length, 0, "mọi lời gọi dùng khóa ở CMS");

  seen.length = 0;
  let asked = 0;
  await createAnalyticsService({ fetch: fetcher as typeof fetch, env, now, cmsSecret: async () => { asked += 1; return "umami_khoa_o_cms"; } }).getAnalyticsOverview();
  assert.ok(seen.length > 0);
  assert.equal(seen.filter((value) => value !== "Bearer umami_khoa_thu").length, 0, "biến môi trường thắng");
  assert.equal(asked, 0, "có biến môi trường thì không hỏi CMS");

  const unavailable = () => { throw new Error("không được gọi"); };
  for (const cmsSecret of [async () => undefined, async () => { throw new Error("không giải mã được"); }]) {
    assert.deepEqual(await createAnalyticsService({ fetch: unavailable as typeof fetch, env: withoutKey, now, cmsSecret }).getAnalyticsOverview(), { connection: "not_connected", periodDays: 7 });
  }
});

test("Gọi Umami bằng API key, 7 ngày giờ Việt Nam, điền đủ ngày không có dữ liệu", async () => {
  const calls: Array<{ url: URL; authorization: string | null }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, authorization: new Headers(init?.headers).get("authorization") });
    if (url.pathname.endsWith("/stats")) return json({ pageviews: "120", visitors: 40, visits: 50, bounces: 20, totaltime: 3000, comparison: { pageviews: 60, visitors: 20, visits: 25, bounces: 5, totaltime: 1000 } });
    if (url.pathname.endsWith("/pageviews")) return json({ pageviews: [{ x: "2026-10-12 00:00:00", y: 30 }, { x: "2026-10-16T00:00:00Z", y: 90 }], sessions: [{ x: "2026-10-16 00:00:00", y: 35 }] });
    return json([{ x: "/news", y: 25 }, { x: null, y: 3 }, { x: "/", y: 10 }]);
  };
  const overview = await createAnalyticsService({ fetch: fetcher as typeof fetch, env, now }).getAnalyticsOverview();

  assert.equal(overview.connection, "connected");
  if (overview.connection !== "connected") return;
  assert.deepEqual(overview.totals, { visitors: 40, visits: 50, pageviews: 120, bounceRate: 0.4, averageVisitSeconds: 60 });
  assert.deepEqual(overview.previous, { visitors: 20, visits: 25, pageviews: 60, bounceRate: 0.2, averageVisitSeconds: 40 });
  assert.deepEqual(overview.daily.map((day) => day.date), ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
  assert.deepEqual(overview.daily.map((day) => day.pageviews), [0, 0, 30, 0, 0, 0, 90]);
  assert.equal(overview.daily[6].visitors, 35);
  assert.deepEqual(overview.topPages, [{ path: "/news", visitors: 25 }, { path: "/", visitors: 10 }]);

  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.authorization, "Bearer umami_khoa_thu");
    assert.equal(call.url.origin + call.url.pathname.replace(/\/[a-z]+$/, ""), `http://umami:3000/api/websites/${websiteId}`);
    // 0h ngày 10/10 giờ Việt Nam = 17h ngày 09/10 UTC.
    assert.equal(call.url.searchParams.get("startAt"), String(Date.parse("2026-10-09T17:00:00Z")));
    assert.equal(call.url.searchParams.get("endAt"), String(now().getTime()));
  }
});

test("Umami lỗi hoặc trả dữ liệu lạ: trạng thái lỗi rõ ràng, không ném ra ngoài", async (context) => {
  context.mock.method(console, "error", () => undefined);
  for (const fetcher of [async () => json({ error: "unauthorized" }, 401), async () => json({ khong: "dung" }), async () => { throw new Error("ECONNREFUSED"); }]) {
    const overview = await createAnalyticsService({ fetch: fetcher as typeof fetch, env, now }).getAnalyticsOverview();
    assert.equal(overview.connection, "error");
  }
});

test("Khoảng thời gian chọn được (30, 90 ngày): biểu đồ đủ số ngày, mốc bắt đầu gửi Umami lùi đúng số ngày; không truyền thì 7 ngày", async () => {
  const ranges: Array<{ startAt: number; endAt: number }> = [];
  const fetcher = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/stats")) ranges.push({ startAt: Number(url.searchParams.get("startAt")), endAt: Number(url.searchParams.get("endAt")) });
    if (url.pathname.endsWith("/stats")) return json({ pageviews: 1, visitors: 1, visits: 1, bounces: 0, totaltime: 10, comparison: { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 } });
    if (url.pathname.endsWith("/pageviews")) return json({ pageviews: [], sessions: [] });
    return json([]);
  };
  const service = createAnalyticsService({ fetch: fetcher as typeof fetch, env, now });
  const month = await service.getAnalyticsOverview(30);
  assert.ok(month.connection === "connected" && month.periodDays === 30 && month.daily.length === 30);
  assert.equal(month.connection === "connected" && month.daily[29].date, "2026-10-16");
  assert.equal(month.connection === "connected" && month.daily[0].date, "2026-09-17");
  assert.equal(Math.ceil((ranges[0].endAt - ranges[0].startAt) / 86_400_000), 30);
  const week = await service.getAnalyticsOverview();
  assert.ok(week.connection === "connected" && week.periodDays === 7 && week.daily.length === 7);
  assert.equal((await service.getAnalyticsOverview(90)).periodDays, 90);
});
