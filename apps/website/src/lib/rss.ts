// /feed.xml: nguồn cấp RSS 2.0 cho tin tức. Trình đọc tin, Google Discover, Feedly, Zapier/IFTTT và các website khác
// theo dõi bài mới qua đây; liên kết trong feed luôn là URL tuyệt đối của website.

export type RssItem = {
  title: string;
  url: string;
  description: string | null;
  publishedAt: Date | null;
  categories?: readonly string[];
};

export type RssChannel = {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  language?: string;
  items: readonly RssItem[];
};

// XML 1.0 không cho ký tự điều khiển (trừ tab, xuống dòng); văn bản nhập từ Word đôi khi có sẵn chúng.
const invalidXml = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(text: string) {
  return text.replace(invalidXml, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function tag(name: string, value: string | null | undefined) {
  return value ? `<${name}>${escapeXml(value)}</${name}>` : "";
}

// RFC 822 (toUTCString) là định dạng ngày RSS 2.0 yêu cầu.
function rssDate(date: Date) {
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

/** Dựng RSS 2.0: bài mới nhất trước, tối đa `limit` bài; ngày dựng feed lấy theo bài mới nhất để feed không đổi khi không có bài mới. */
export function buildRssFeed(channel: RssChannel, limit = 30) {
  const items = [...channel.items].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)).slice(0, limit);
  const newest = items.find((item) => item.publishedAt)?.publishedAt;
  const lastBuild = newest ? rssDate(newest) : null;
  const body = items.map((item) => {
    const published = item.publishedAt ? rssDate(item.publishedAt) : null;
    return [
      "    <item>",
      `      ${tag("title", item.title)}`,
      `      ${tag("link", item.url)}`,
      `      <guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
      published ? `      <pubDate>${published}</pubDate>` : "",
      item.description ? `      ${tag("description", item.description)}` : "",
      ...(item.categories ?? []).map((category) => `      ${tag("category", category)}`),
      "    </item>",
    ].filter((line) => line.trim()).join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    ${tag("title", channel.title)}`,
    `    ${tag("link", channel.siteUrl)}`,
    `    ${tag("description", channel.description)}`,
    `    <language>${escapeXml(channel.language ?? "vi")}</language>`,
    lastBuild ? `    <lastBuildDate>${lastBuild}</lastBuildDate>` : "",
    `    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml" />`,
    ...body,
    "  </channel>",
    "</rss>",
    "",
  ].filter((line) => line.trim()).join("\n");
}
