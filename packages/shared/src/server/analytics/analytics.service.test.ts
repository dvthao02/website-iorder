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

test("Gọi Umami bằng API key, 7 ngày giờ Việt Nam, điền đủ ngày không có dữ liệu", async () => {
  const calls: Array<{ url: URL; authorization: string | null }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, authorization: new Headers(init?.headers).get("authorization") });
    if (url.pathname.endsWith("/stats")) return json({ pageviews: "120", visitors: 40, visits: 50, bounces: 20, totaltime: 3000, comparison: { pageviews: 60, visitors: 20, visits: 25, bounces: 5, totaltime: 1000 } });
    if (url.pathname.endsWith("/pageviews")) return json({ pageviews: [{ x: "2026-10-12 00:00:00", y: 30 }, { x: "2026-10-16T00:00:00Z", y: 90 }], sessions: [{ x: "2026-10-16 00:00:00", y: 35 }] });
    return json([{ x: "/tin-tuc", y: 25 }, { x: null, y: 3 }, { x: "/", y: 10 }]);
  };
  const overview = await createAnalyticsService({ fetch: fetcher as typeof fetch, env, now }).getAnalyticsOverview();

  assert.equal(overview.connection, "connected");
  if (overview.connection !== "connected") return;
  assert.deepEqual(overview.totals, { visitors: 40, visits: 50, pageviews: 120, bounceRate: 0.4, averageVisitSeconds: 60 });
  assert.deepEqual(overview.previous, { visitors: 20, visits: 25, pageviews: 60, bounceRate: 0.2, averageVisitSeconds: 40 });
  assert.deepEqual(overview.daily.map((day) => day.date), ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
  assert.deepEqual(overview.daily.map((day) => day.pageviews), [0, 0, 30, 0, 0, 0, 90]);
  assert.equal(overview.daily[6].visitors, 35);
  assert.deepEqual(overview.topPages, [{ path: "/tin-tuc", visitors: 25 }, { path: "/", visitors: 10 }]);

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
