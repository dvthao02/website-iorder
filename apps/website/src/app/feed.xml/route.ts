import { isSitemapEligible } from "@iorder/shared/server/shared/content-seo";
import { getPublishedPostSummaries, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { buildRssFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";

// Nguồn cấp RSS tin tức (không gồm hướng dẫn). Cùng điều kiện với sitemap: cần URL website, tôn trọng "cho phép công cụ tìm kiếm"
// và bỏ bài noindex/ẩn khỏi sơ đồ website.
export async function GET() {
  const config = await getPublishingConfig();
  const site = config.siteUrl;
  if (!site || !config.allowSearchIndexing) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
  const [profile, posts] = await Promise.all([getSiteProfile(), getPublishedPostSummaries()]);
  const siteName = config.defaultTitle ?? profile?.companyName ?? "iOrder";
  const xml = buildRssFeed({
    title: `${siteName} – Tin tức`,
    description: config.defaultDescription ?? `Tin tức và bài viết mới nhất từ ${siteName}.`,
    siteUrl: new URL("/news", site).toString(),
    feedUrl: new URL("/feed.xml", site).toString(),
    items: posts.filter((post) => post.type !== "guide" && isSitemapEligible(post.seo)).map((post) => ({
      title: post.title,
      url: new URL(`/news/${post.slug}`, site).toString(),
      description: post.excerpt,
      publishedAt: post.publishedAt ?? post.createdAt,
      categories: post.categories.map((category) => category.name),
    })),
  });
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" } });
}
