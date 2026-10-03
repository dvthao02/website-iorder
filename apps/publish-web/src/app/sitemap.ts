import type { MetadataRoute } from "next";
import { getEquipment } from "@/lib/backend";
import { getPublishedOfferingSummaries } from "@/lib/backend";
import { getPublishedPageSummaries } from "@/lib/backend";
import { getPublishedPostSummaries } from "@/lib/backend";
import { getPublishingConfig } from "@/lib/backend";
import { getTaxonomy } from "@/lib/backend";

export const dynamic = "force-dynamic";

const catalogByType = { software: "phan-mem", solution: "giai-phap", service: "dich-vu" } as const;
const dedicatedPageSlugs = new Set(["home", "contact", "about", "terms", "privacy-policy", "support-faq", "remote-support", "support-videos"]);
function url(path: string, siteUrl: string) { return new URL(path, siteUrl).toString(); }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getPublishingConfig();
  const siteUrl = config.siteUrl;
  if (!siteUrl) return [];
  const [pages, posts, equipment, taxonomy, ...offeringLists] = await Promise.all([getPublishedPageSummaries(), getPublishedPostSummaries(), getEquipment(true), getTaxonomy(), ...Object.keys(catalogByType).map(type => getPublishedOfferingSummaries(type))]);
  const staticPaths = ["/", "/lien-he", "/gioi-thieu", "/terms", "/privacy-policy", "/ho-tro/faq", "/ho-tro-tu-xa", "/ho-tro/video", "/tin-tuc", "/thiet-bi", "/ho-tro/cai-dat", ...Object.values(catalogByType).map(path => `/${path}`)];
  return [
    ...staticPaths.map(path => ({ url: url(path, siteUrl) })),
    ...pages.filter(page => !dedicatedPageSlugs.has(page.slug)).map(page => ({ url: url(`/trang/${page.slug}`, siteUrl), lastModified: page.updatedAt })),
    ...posts.map(post => ({ url: url(post.type === "guide" ? `/ho-tro/cai-dat/${post.slug}` : `/tin-tuc/${post.slug}`, siteUrl), lastModified: post.publishedAt ?? post.createdAt })),
    ...equipment.map(item => ({ url: url(`/thiet-bi/${item.slug}`, siteUrl) })),
    ...taxonomy.categories.map(category => ({ url: url(`/tin-tuc/chuyen-muc/${category.slug}`, siteUrl), lastModified: category.updatedAt })),
    ...taxonomy.tags.map(tag => ({ url: url(`/tin-tuc/the/${tag.slug}`, siteUrl), lastModified: tag.updatedAt })),
    ...offeringLists.flatMap((items, index) => items.map(item => ({ url: url(`/${Object.values(catalogByType)[index]}/${item.slug}`, siteUrl) }))),
  ];
}
