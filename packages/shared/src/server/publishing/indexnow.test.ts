import assert from "node:assert/strict";
import { test } from "node:test";

import { indexNowRequestBody, isPublicSiteUrl, parseIndexNowKey, resolveIndexNowKey, selectIndexNowUrls, sitemapLocations } from "./indexnow";

const sitemap = `<?xml version="1.0"?><urlset><url><loc>https://iorder.vn/news/bai-a</loc></url><url><loc>https://iorder.vn/equipment/ket?a=1&amp;b=2</loc></url><url><loc> https://iorder.vn/ </loc></url></urlset>`;

test("Khóa IndexNow chỉ nhận 8–128 ký tự chữ, số, gạch ngang; thiếu hoặc sai thì tắt", () => {
  assert.equal(parseIndexNowKey(" abcd1234-EF "), "abcd1234-EF");
  assert.equal(parseIndexNowKey(undefined), null);
  assert.equal(parseIndexNowKey("ngan"), null);
  assert.equal(parseIndexNowKey("co khoang trang 123"), null);
});

test("Đọc <loc> trong sitemap, giải mã &amp; và bỏ khoảng trắng", () => {
  assert.deepEqual(sitemapLocations(sitemap), ["https://iorder.vn/news/bai-a", "https://iorder.vn/equipment/ket?a=1&b=2", "https://iorder.vn/"]);
});

test("Chỉ báo URL vừa làm mới mà có trong sitemap: bản nháp, mẫu động và trang ngoài sitemap bị bỏ; không trùng lặp", () => {
  const urls = selectIndexNowUrls({ paths: ["/news/bai-a", "/news/bai-a", "/support/guides/bai-a", "/news/[slug]", "/", "/news/ban-nhap", "tin-tuc/khong-co-gach"], siteUrl: "https://iorder.vn", sitemap });
  assert.deepEqual(urls, ["https://iorder.vn/news/bai-a", "https://iorder.vn/"]);
});

test("Yêu cầu IndexNow có host, khóa và vị trí tệp khóa trên cùng website", () => {
  assert.deepEqual(indexNowRequestBody({ siteUrl: "https://iorder.vn/", key: "abcd1234", urls: ["https://iorder.vn/"] }), { host: "iorder.vn", key: "abcd1234", keyLocation: "https://iorder.vn/indexnow.txt", urlList: ["https://iorder.vn/"] });
});

test("Địa chỉ nội bộ hoặc local không gửi IndexNow", () => {
  assert.equal(isPublicSiteUrl("https://iorder.vn"), true);
  for (const value of ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.1.5", "http://iorder.local", "ftp://iorder.vn", "khong-phai-url"]) assert.equal(isPublicSiteUrl(value), false, value);
});

test("Khóa IndexNow tự sinh từ secret nên backend và website luôn ra cùng một khóa; khóa đặt tay thắng; có thể tắt", () => {
  const secret = "mot-secret-dai-dung-chung-cho-api-va-website";
  const derived = resolveIndexNowKey({ PUBLISH_WEB_REVALIDATE_SECRET: secret });
  assert.match(derived ?? "", /^[0-9a-f]{32}$/);
  assert.equal(resolveIndexNowKey({ PUBLISH_WEB_REVALIDATE_SECRET: secret }), derived);
  assert.notEqual(resolveIndexNowKey({ PUBLISH_WEB_REVALIDATE_SECRET: "secret-khac-hoan-toan" }), derived);
  assert.ok(!derived?.includes(secret));
  assert.equal(resolveIndexNowKey({ INDEXNOW_KEY: "khoa-dat-tay-1234", PUBLISH_WEB_REVALIDATE_SECRET: secret }), "khoa-dat-tay-1234");
  assert.equal(resolveIndexNowKey({ INDEXNOW_KEY: "sai dinh dang", PUBLISH_WEB_REVALIDATE_SECRET: secret }), null);
  assert.equal(resolveIndexNowKey({ INDEXNOW_DISABLED: "true", PUBLISH_WEB_REVALIDATE_SECRET: secret }), null);
  assert.equal(resolveIndexNowKey({}), null);
});
