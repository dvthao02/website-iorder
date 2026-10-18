import type { MetadataRoute } from "next";
import { getEquipment } from "@/lib/backend";
import { getPublishedOfferingSummaries } from "@/lib/backend";
import { getPublishedPageSummaries } from "@/lib/backend";
import { getPublishedPostSummaries } from "@/lib/backend";
import { getPublishingConfig } from "@/lib/backend";
import { getTaxonomy } from "@/lib/backend";
import { getFixedWebsitePage } from "@iorder/core/server/pages/pages.contract";

export const revalidate = 0;

const catalogByType = { software: "phan-mem", solution: "giai-phap", service: "dich-vu" } as const;
// Mọi URL public là một Trang: chỉ liệt kê trang đã xuất bản. Trang hệ thống dùng route riêng
// (publicPath), trang tự tạo nằm dưới /trang/{slug}; phần neo trong trang khác (#) không có URL riêng.
function pagePath(slug: string) { const fixed = getFixedWebsitePage(slug); return fixed ? (fixed.publicPath.includes("#") ? null : fixed.publicPath) : `/trang/${slug}`; }
function url(path: string, siteUrl: string) { return new URL(path, siteUrl).toString(); }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getPublishingConfig();
  const siteUrl = config.siteUrl;
  if (!siteUrl) return [];
  const [pages, posts, equipment, taxonomy, ...offeringLists] = await Promise.all([getPublishedPageSummaries(), getPublishedPostSummaries(), getEquipment(true), getTaxonomy(), ...Object.keys(catalogByType).map(type => getPublishedOfferingSummaries(type))]);
  return [
    ...pages.flatMap(page => { const path = pagePath(page.slug); return path ? [{ url: url(path, siteUrl), lastModified: page.updatedAt }] : []; }),
    ...posts.map(post => ({ url: url(post.type === "guide" ? `/ho-tro/cai-dat/${post.slug}` : `/tin-tuc/${post.slug}`, siteUrl), lastModified: post.publishedAt ?? post.createdAt })),
    ...equipment.map(item => ({ url: url(`/thiet-bi/${item.slug}`, siteUrl), lastModified: item.updatedAt })),
    ...taxonomy.categories.map(category => ({ url: url(`/tin-tuc/chuyen-muc/${category.slug}`, siteUrl), lastModified: category.updatedAt })),
    ...taxonomy.tags.map(tag => ({ url: url(`/tin-tuc/the/${tag.slug}`, siteUrl), lastModified: tag.updatedAt })),
    ...offeringLists.flatMap((items, index) => items.map(item => ({ url: url(`/${Object.values(catalogByType)[index]}/${item.slug}`, siteUrl), lastModified: item.publishedAt ?? undefined }))),
  ];
}
