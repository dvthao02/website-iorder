import type { PublicOfferingDetail, PublicOfferingSummary } from "@iorder/core/server/offerings/offering-content.contract";
import type { PublicPostDetail, PublicPostSummary, PublicPostType } from "@iorder/core/server/posts/posts.contract";
import type { getEquipment as getEquipmentFromService } from "@iorder/core/server/equipment/equipment.service";
import type { getMediaById as getMediaByIdFromService } from "@iorder/core/server/media/media.service";
import type { getNavigation as getNavigationFromService } from "@iorder/core/server/navigation/navigation.service";
import type { getPublishedPage as getPublishedPageFromService, getPublishedPageSummaries as getPublishedPageSummariesFromService } from "@iorder/core/server/pages/pages.service";
import type { getCatalogContent as getCatalogContentFromService } from "@iorder/core/server/settings/catalog-content.service";
import type { getExternalLinks as getExternalLinksFromService } from "@iorder/core/server/settings/external-links.service";
import type { getListingContent as getListingContentFromService } from "@iorder/core/server/settings/listing-content.service";
import type { getPublishingConfig as getPublishingConfigFromService } from "@iorder/core/server/settings/publishing.service";
import type { getSiteProfile as getSiteProfileFromService } from "@iorder/core/server/settings/profile.service";
import type { getEnabledSupportDownloads as getEnabledSupportDownloadsFromService } from "@iorder/core/server/support/support-downloads.service";
import type { getPartners as getPartnersFromService, getTestimonials as getTestimonialsFromService } from "@iorder/core/server/supporting/supporting.service";
import type { getTaxonomy as getTaxonomyFromService } from "@iorder/core/server/taxonomy/taxonomy.service";
import { publicContentCacheTag } from "@iorder/core/server/publishing/cache-invalidation";
import { cache } from "react";
import { cookies, draftMode } from "next/headers";

type SharedContent = {
  settings: {
    config: Awaited<ReturnType<typeof getPublishingConfigFromService>>;
    profile: Awaited<ReturnType<typeof getSiteProfileFromService>>;
    externalLinks: Awaited<ReturnType<typeof getExternalLinksFromService>>;
    catalogContent: Awaited<ReturnType<typeof getCatalogContentFromService>>;
    listingContent: Awaited<ReturnType<typeof getListingContentFromService>>;
  };
  navigation: {
    header: Awaited<ReturnType<typeof getNavigationFromService>>;
    headerCta: Awaited<ReturnType<typeof getNavigationFromService>>;
    footer: Awaited<ReturnType<typeof getNavigationFromService>>;
  };
};
type PublicEquipment = Awaited<ReturnType<typeof getEquipmentFromService>>[number];
type PublishedPage = NonNullable<Awaited<ReturnType<typeof getPublishedPageFromService>>>;
type PublishedPageSummaries = Awaited<ReturnType<typeof getPublishedPageSummariesFromService>>;
type PublicTaxonomy = Awaited<ReturnType<typeof getTaxonomyFromService>>;
type PublicSupportDownloads = Awaited<ReturnType<typeof getEnabledSupportDownloadsFromService>>;
type PublicPartners = Awaited<ReturnType<typeof getPartnersFromService>>;
type PublicTestimonials = Awaited<ReturnType<typeof getTestimonialsFromService>>;
type PublicMedia = Awaited<ReturnType<typeof getMediaByIdFromService>>;

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3002").replace(/\/$/, "");
const publicCacheOptions = { cache: "force-cache" as const, next: { revalidate: 60, tags: [publicContentCacheTag] } };

function reviveDates(value: unknown, key = ""): unknown {
  if (typeof value === "string" && /(?:At|Date)$/.test(key) && !Number.isNaN(Date.parse(value))) return new Date(value);
  if (Array.isArray(value)) return value.map((item) => reviveDates(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, reviveDates(item, name)]));
  return value;
}

const fetchPublicResource = cache(async (resource: string, encodedParams = "") => {
  const query = new URLSearchParams(encodedParams);
  query.set("resource", resource);
  // Bản nháp đang xem trước không bao giờ đi qua cache.
  const response = await fetch(`${backendUrl}/api/public/content?${query.toString()}`, query.has("preview") ? { cache: "no-store" } : publicCacheOptions);
  if (!response.ok) throw new Error("Không thể tải dữ liệu website từ Backend.");
  return reviveDates(await response.json() as unknown);
});

// Chế độ xem trước (Draft Mode + cookie token do /api/preview đặt): chỉ trang, bài viết và catalog nhận bản nháp.
export const previewCookieName = "iorder_preview";
const previewableResources = new Set(["page", "post", "offering"]);
async function previewToken() {
  if (!(await draftMode()).isEnabled) return undefined;
  return (await cookies()).get(previewCookieName)?.value;
}

async function publicResource<T>(resource: string, params: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  if (previewableResources.has(resource)) {
    const token = await previewToken();
    if (token) query.set("preview", token);
  }
  return fetchPublicResource(resource, query.toString()) as Promise<T>;
}

const getSharedContent = cache(() => publicResource<SharedContent>("shared"));

export function getOfferingTypeFromCatalogPath(path: string) {
  return ({ "phan-mem": "software", "giai-phap": "solution", "dich-vu": "service" } as const)[path as "phan-mem" | "giai-phap" | "dich-vu"];
}
export async function getPublishingConfig() { return (await getSharedContent()).settings.config; }
export async function getSiteProfile() { return (await getSharedContent()).settings.profile; }
export async function getExternalLinks() { return (await getSharedContent()).settings.externalLinks; }
export async function getCatalogContent() { return (await getSharedContent()).settings.catalogContent; }
export async function getListingContent() { return (await getSharedContent()).settings.listingContent; }
export async function getNavigation(location = "header") { const navigation = (await getSharedContent()).navigation; return location === "header_cta" ? navigation.headerCta : location === "footer" ? navigation.footer : navigation.header; }
// Trang hệ thống: kèm cờ "đã tồn tại" để phân biệt trang bị ẩn với trang chưa tạo.
export async function getPublishedPageState(slug: string) { const result = await publicResource<{ page: PublishedPage | null; systemPageExists?: boolean }>("page", { slug }); return { page: result.page ?? undefined, exists: Boolean(result.page || result.systemPageExists) }; }
export async function getPublishedPage(slug: string) { return (await publicResource<{ page: PublishedPage | null }>("page", { slug })).page ?? undefined; }
export async function getPublishedPageSummaries() { return (await publicResource<{ pages: PublishedPageSummaries }>("page-summaries")).pages; }
export async function getPublishedPostSummaries(type?: PublicPostType): Promise<PublicPostSummary[]> { return (await publicResource<{ posts: PublicPostSummary[] }>("post-summaries", { postType: type })).posts; }
export async function getPublishedPostBySlug(slug: string): Promise<PublicPostDetail | undefined> { return (await publicResource<{ post: PublicPostDetail | null }>("post", { slug })).post ?? undefined; }
export async function getPublishedPostsByTaxonomy(kind: "category" | "tag", slug: string): Promise<PublicPostSummary[]> { return (await publicResource<{ posts: PublicPostSummary[] }>("post-taxonomy", { taxonomyKind: kind, slug })).posts; }
export async function findCategoryBySlug(slug: string) { return (await getTaxonomy()).categories.find((category) => category.slug === slug); }
export async function findTagBySlug(slug: string) { return (await getTaxonomy()).tags.find((tag) => tag.slug === slug); }
export async function getTaxonomy() { return (await publicResource<{ taxonomy: PublicTaxonomy }>("taxonomy")).taxonomy; }
export async function getPublishedOfferingSummaries(type: string): Promise<PublicOfferingSummary[]> { return (await publicResource<{ offerings: PublicOfferingSummary[] }>("offering-summaries", { offeringType: type })).offerings; }
export async function getPublishedOfferingBySlug(type: string, slug: string): Promise<PublicOfferingDetail | undefined> { return (await publicResource<{ offering: PublicOfferingDetail | null }>("offering", { offeringType: type, slug })).offering ?? undefined; }
export async function getEquipment(_publicOnly = false): Promise<PublicEquipment[]> { void _publicOnly; return (await publicResource<{ equipment: PublicEquipment[] }>("equipment")).equipment; }
export async function getEnabledSupportDownloads(): Promise<PublicSupportDownloads> { return (await publicResource<{ downloads: PublicSupportDownloads }>("downloads")).downloads; }
export async function getPartners(_enabledOnly = false): Promise<PublicPartners> { void _enabledOnly; return (await publicResource<{ partners: PublicPartners }>("partners")).partners; }
export async function getTestimonials(_enabledOnly = false): Promise<PublicTestimonials> { void _enabledOnly; return (await publicResource<{ testimonials: PublicTestimonials }>("testimonials")).testimonials; }
// Logo/OG image are decorative: a failed lookup renders the page without them.
export async function getMediaById(id: string) {
  try {
    const response = await fetch(`${backendUrl}/api/public/media/${encodeURIComponent(id)}`, publicCacheOptions);
    if (!response.ok) return null;
    return (await response.json() as { asset: PublicMedia }).asset;
  } catch {
    return null;
  }
}
export async function getEnabledRedirect(path: string): Promise<{ destinationPath: string; statusCode: 301 | 308 } | null> {
  const response = await fetch(`${backendUrl}/api/public/redirect?path=${encodeURIComponent(path)}`, publicCacheOptions);
  if (!response.ok) return null;
  return (await response.json()).redirect;
}
