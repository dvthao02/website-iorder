import type { MetadataRoute } from "next";
import { getEquipment } from "@/lib/backend";
import { getPublishedAuthorSummaries } from "@/lib/backend";
import { getPublishedOfferingSummaries } from "@/lib/backend";
import { getPublishedPageSummaries } from "@/lib/backend";
import { getPublishedPostSummaries } from "@/lib/backend";
import { getPublishingConfig } from "@/lib/backend";
import { getTaxonomy } from "@/lib/backend";
import { getFixedWebsitePage } from "@iorder/shared/server/pages/pages.contract";
import { isSitemapEligible } from "@iorder/shared/server/shared/content-seo";

export const revalidate = 0;

const catalogByType = { software: "software", solution: "solutions", service: "services" } as const;
// Mọi URL public là một Trang: chỉ liệt kê trang đã xuất bản. Trang hệ thống dùng route riêng
// (publicPath), trang tự tạo nằm dưới /pages/{slug}; phần neo trong trang khác (#) không có URL riêng.
function pagePath(slug: string) { const fixed = getFixedWebsitePage(slug); return fixed ? (fixed.publicPath.includes("#") ? null : fixed.publicPath) : `/pages/${slug}`; }
function url(path: string, siteUrl: string) { return new URL(path, siteUrl).toString(); }
// Ảnh bìa đi kèm URL trong sitemap để Google Hình ảnh khám phá và gắn ảnh với đúng trang.
function withImage(imagePath: string | null | undefined, siteUrl: string) { return imagePath ? { images: [url(imagePath, siteUrl)] } : {}; }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getPublishingConfig();
  const siteUrl = config.siteUrl;
  if (!siteUrl || !config.allowSearchIndexing) return [];
  const [pages, posts, equipment, taxonomy, authors, ...offeringLists] = await Promise.all([getPublishedPageSummaries(), getPublishedPostSummaries(), getEquipment(true), getTaxonomy(), getPublishedAuthorSummaries(), ...Object.keys(catalogByType).map(type => getPublishedOfferingSummaries(type))]);
  return [
    // Trung tâm hỗ trợ: trang tổng hợp dựng từ dữ liệu CMS (không phải một Trang riêng).
    { url: url("/support", siteUrl) },
    ...pages.filter(page => isSitemapEligible(page.seo)).flatMap(page => { const path = pagePath(page.slug); return path ? [{ url: url(path, siteUrl), lastModified: page.updatedAt }] : []; }),
    ...posts.filter(post => isSitemapEligible(post.seo)).map(post => ({ url: url(post.type === "guide" ? `/support/guides/${post.slug}` : `/news/${post.slug}`, siteUrl), lastModified: post.updatedAt, ...withImage(post.cover?.url, siteUrl) })),
    ...equipment.filter(item => isSitemapEligible(item.seo)).map(item => ({ url: url(`/equipment/${item.slug}`, siteUrl), lastModified: item.updatedAt, ...withImage(item.coverUrl, siteUrl) })),
    // Chuyên mục/thẻ chưa có bài nào là trang mỏng (và đã đặt noindex): không đưa vào sitemap.
    ...taxonomy.categories.filter(category => posts.some(post => post.categories.some(term => term.slug === category.slug))).map(category => ({ url: url(`/news/category/${category.slug}`, siteUrl), lastModified: category.updatedAt })),
    // Trang tác giả: chỉ tác giả đã bật trang và có bài đang hiển thị (cùng điều kiện với chính trang).
    ...authors.map(author => ({ url: url(`/author/${author.slug}`, siteUrl), lastModified: author.updatedAt })),
    ...taxonomy.tags.filter(tag => posts.some(post => post.tags.some(term => term.slug === tag.slug))).map(tag => ({ url: url(`/news/tag/${tag.slug}`, siteUrl), lastModified: tag.updatedAt })),
    ...offeringLists.flatMap((items, index) => items.filter(item => isSitemapEligible(item.seo)).map(item => ({ url: url(`/${Object.values(catalogByType)[index]}/${item.slug}`, siteUrl), lastModified: item.publishedAt ?? undefined, ...withImage(item.cover?.url, siteUrl) }))),
  ];
}
