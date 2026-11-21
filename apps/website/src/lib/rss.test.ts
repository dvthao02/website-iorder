import assert from "node:assert/strict";
import { test } from "node:test";

import { buildRssFeed, escapeXml } from "./rss";

const channel = { title: "iOrder – Tin tức", description: "Tin mới", siteUrl: "https://iorder.vn/tin-tuc", feedUrl: "https://iorder.vn/feed.xml" };

test("RSS có kênh, liên kết tự tham chiếu, bài mới nhất trước và ngày theo RFC 822", () => {
  const xml = buildRssFeed({ ...channel, items: [
    { title: "Bài cũ", url: "https://iorder.vn/tin-tuc/cu", description: "Mô tả cũ", publishedAt: new Date("2026-10-01T03:00:00Z"), categories: ["Mẹo bán hàng"] },
    { title: "Bài mới", url: "https://iorder.vn/tin-tuc/moi", description: null, publishedAt: new Date("2026-11-15T03:00:00Z") },
  ] });
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"'));
  assert.ok(xml.indexOf("Bài mới") < xml.indexOf("Bài cũ"));
  assert.ok(xml.includes("<pubDate>Sun, 15 Nov 2026 03:00:00 GMT</pubDate>"));
  assert.ok(xml.includes("<lastBuildDate>Sun, 15 Nov 2026 03:00:00 GMT</lastBuildDate>"));
  assert.ok(xml.includes('<atom:link href="https://iorder.vn/feed.xml" rel="self" type="application/rss+xml" />'));
  assert.ok(xml.includes('<guid isPermaLink="true">https://iorder.vn/tin-tuc/moi</guid>'));
  assert.ok(xml.includes("<category>Mẹo bán hàng</category>"));
  assert.equal(xml.match(/<description>/g)?.length, 2, "kênh + bài có mô tả; bài không mô tả không có thẻ rỗng");
  assert.ok(!/<[a-z]+><\/[a-z]+>/.test(xml));
});

test("Ký tự đặc biệt được thoát và ký tự điều khiển không hợp lệ trong XML bị bỏ", () => {
  assert.equal(escapeXml(`A & B <c> "d" 'e'\u0000\u000B`), "A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;");
  const xml = buildRssFeed({ ...channel, items: [{ title: "Giá < 5 triệu & rẻ", url: "https://iorder.vn/x?a=1&b=2", description: null, publishedAt: null }] });
  assert.ok(xml.includes("<title>Giá &lt; 5 triệu &amp; rẻ</title>"));
  assert.ok(xml.includes("<link>https://iorder.vn/x?a=1&amp;b=2</link>"));
  assert.ok(!xml.includes("<pubDate>") && !xml.includes("<lastBuildDate>"));
});

test("Chỉ giữ tối đa số bài quy định, bài mới nhất", () => {
  const items = Array.from({ length: 50 }, (_, index) => ({ title: `Bài ${index}`, url: `https://iorder.vn/tin-tuc/${index}`, description: null, publishedAt: new Date(Date.UTC(2026, 0, 1 + index)) }));
  const xml = buildRssFeed({ ...channel, items }, 30);
  assert.equal(xml.match(/<item>/g)?.length, 30);
  assert.ok(xml.includes("Bài 49") && !xml.includes("Bài 19<"));
});
