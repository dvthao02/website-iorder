import type { EquipmentInput } from "@iorder/core/server/equipment/equipment.contract";
import type { PublicOfferingDetail, PublicOfferingSummary } from "@iorder/core/server/offerings/offering-content.contract";
import type { PublicPostDetail, PublicPostSummary, PublicPostType } from "@iorder/core/server/posts/posts.contract";
import { cache } from "react";

type PublicContent = {
  settings: { config: any; profile: any; externalLinks: any; catalogContent: any; listingContent: any };
  navigation: { header: any[] | null; headerCta: any[] | null; footer: any[] | null };
  pages: any[];
  pageSummaries: any[];
  posts: any[];
  postSummaries: any[];
  equipment: any[];
  taxonomy: { categories: any[]; tags: any[] };
  downloads: any[];
  partners: any[];
  testimonials: any[];
  offerings: Record<"software" | "solution" | "service", any[]>;
};
type PublicEquipment = EquipmentInput & { id: string; groupName: string; coverUrl: string | null; coverAlt: string | null; version: number; updatedAt: Date };

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3002").replace(/\/$/, "");

function reviveDates(value: unknown, key = ""): any {
  if (typeof value === "string" && /(?:At|Date)$/.test(key) && !Number.isNaN(Date.parse(value))) return new Date(value);
  if (Array.isArray(value)) return value.map((item) => reviveDates(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, reviveDates(item, name)]));
  return value;
}

const getContent = cache(async (): Promise<PublicContent> => {
  const response = await fetch(`${backendUrl}/api/public/content`, { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể tải dữ liệu website từ Backend.");
  return reviveDates(await response.json());
});

export function getOfferingTypeFromCatalogPath(path: string) {
  return ({ "phan-mem": "software", "giai-phap": "solution", "dich-vu": "service" } as const)[path as "phan-mem" | "giai-phap" | "dich-vu"];
}
export async function getPublishingConfig() { return (await getContent()).settings.config; }
export async function getSiteProfile() { return (await getContent()).settings.profile; }
export async function getExternalLinks() { return (await getContent()).settings.externalLinks; }
export async function getCatalogContent() { return (await getContent()).settings.catalogContent; }
export async function getListingContent() { return (await getContent()).settings.listingContent; }
export async function getNavigation(location = "header") { const navigation = (await getContent()).navigation; return location === "header_cta" ? navigation.headerCta : location === "footer" ? navigation.footer : navigation.header; }
export async function getPublishedPage(slug: string) { return (await getContent()).pages.find((page) => page.slug === slug); }
export async function getPublishedPageSummaries() { return (await getContent()).pageSummaries; }
export async function getPublishedPostSummaries(type?: PublicPostType): Promise<PublicPostSummary[]> { const content = await getContent(); return (type ? content.postSummaries.filter((post) => post.type === type) : content.postSummaries) as PublicPostSummary[]; }
export async function getPublishedPostBySlug(slug: string): Promise<PublicPostDetail | undefined> { return (await getContent()).posts.find((post) => post.slug === slug) as PublicPostDetail | undefined; }
export async function getPublishedPostsByTaxonomy(kind: "category" | "tag", slug: string): Promise<PublicPostSummary[]> { return (await getContent()).postSummaries.filter((post) => post[`${kind === "category" ? "categories" : "tags"}`].some((term: any) => term.slug === slug)) as PublicPostSummary[]; }
export async function findCategoryBySlug(slug: string) { return (await getContent()).taxonomy.categories.find((category) => category.slug === slug); }
export async function findTagBySlug(slug: string) { return (await getContent()).taxonomy.tags.find((tag) => tag.slug === slug); }
export async function getTaxonomy() { return (await getContent()).taxonomy; }
export async function getPublishedOfferingSummaries(type: string): Promise<PublicOfferingSummary[]> { return ((await getContent()).offerings[type as "software" | "solution" | "service"] ?? []) as PublicOfferingSummary[]; }
export async function getPublishedOfferingBySlug(type: string, slug: string): Promise<PublicOfferingDetail | undefined> { return ((await getContent()).offerings[type as "software" | "solution" | "service"] ?? []).find((offering) => offering.slug === slug) as PublicOfferingDetail | undefined; }
export async function getEquipment(publicOnly = false): Promise<PublicEquipment[]> { const equipment = (await getContent()).equipment as PublicEquipment[]; return publicOnly ? equipment : equipment; }
export async function getEnabledSupportDownloads(): Promise<any[]> { return (await getContent()).downloads; }
export async function getPartners(enabledOnly = false): Promise<any[]> { const partners = (await getContent()).partners; return enabledOnly ? partners.filter((partner) => partner.isEnabled) : partners; }
export async function getTestimonials(enabledOnly = false): Promise<any[]> { const testimonials = (await getContent()).testimonials; return enabledOnly ? testimonials.filter((testimonial) => testimonial.isEnabled) : testimonials; }
export async function getMediaById(id: string) {
  const response = await fetch(`${backendUrl}/api/public/media/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()).asset;
}
export async function getEnabledRedirect(path: string) {
  const response = await fetch(`${backendUrl}/api/public/redirect?path=${encodeURIComponent(path)}`, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()).redirect;
}
