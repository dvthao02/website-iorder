import { headers } from "next/headers";
import { cache } from "react";

import type { getAnalyticsOverview as getAnalyticsOverviewFromCore } from "@iorder/core/server/analytics/analytics.service";
import type { getRequestAdministrator as getRequestAdministratorFromCore } from "@iorder/core/server/auth/request-administrator";
import type { getRecentAuditLogs as getRecentAuditLogsFromCore } from "@iorder/core/server/audit/audit.service";
import type { getEquipment as getEquipmentFromCore, getEquipmentGroups as getEquipmentGroupsFromCore } from "@iorder/core/server/equipment/equipment.service";
import type { getLeads as getLeadsFromCore } from "@iorder/core/server/leads/leads.service";
import type { getAdminMedia as getAdminMediaFromCore } from "@iorder/core/server/media/media.service";
import type { getAdminNavigation as getAdminNavigationFromCore } from "@iorder/core/server/navigation/navigation.service";
import type { getAdminOfferings as getAdminOfferingsFromCore } from "@iorder/core/server/offerings/offerings.service";
import type { getAdminPages as getAdminPagesFromCore } from "@iorder/core/server/pages/pages.service";
import type { getAdminPosts as getAdminPostsFromCore } from "@iorder/core/server/posts/posts.service";
import type { getPublishingReadiness as getPublishingReadinessFromCore } from "@iorder/core/server/publishing-readiness/publishing-readiness.service";
import type { getRedirects as getRedirectsFromCore } from "@iorder/core/server/redirects/redirects.service";
import type { getCatalogContent as getCatalogContentFromCore } from "@iorder/core/server/settings/catalog-content.service";
import type { getExternalLinks as getExternalLinksFromCore } from "@iorder/core/server/settings/external-links.service";
import type { getListingContent as getListingContentFromCore } from "@iorder/core/server/settings/listing-content.service";
import type { getSiteProfile as getSiteProfileFromCore } from "@iorder/core/server/settings/profile.service";
import type { getPublishingConfig as getPublishingConfigFromCore } from "@iorder/core/server/settings/publishing.service";
import type { getAdminSupportDownloads as getAdminSupportDownloadsFromCore } from "@iorder/core/server/support/support-downloads.service";
import type { getPartners as getPartnersFromCore, getTestimonials as getTestimonialsFromCore } from "@iorder/core/server/supporting/supporting.service";
import type { getTaxonomy as getTaxonomyFromCore } from "@iorder/core/server/taxonomy/taxonomy.service";
import type { getCmsUsers as getCmsUsersFromCore } from "@iorder/core/server/users/users.service";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3002").replace(/\/$/, "");
export const administratorSessionCookieName = "iorder_admin_session";

type Administrator = NonNullable<Awaited<ReturnType<typeof getRequestAdministratorFromCore>>>;
type AnalyticsOverview = Awaited<ReturnType<typeof getAnalyticsOverviewFromCore>>;
type PublishingReadiness = Awaited<ReturnType<typeof getPublishingReadinessFromCore>>;
type AdminOfferings = Awaited<ReturnType<typeof getAdminOfferingsFromCore>>;
type AdminPages = Awaited<ReturnType<typeof getAdminPagesFromCore>>;
type AdminPosts = Awaited<ReturnType<typeof getAdminPostsFromCore>>;
type Equipment = Awaited<ReturnType<typeof getEquipmentFromCore>>;
type EquipmentGroups = Awaited<ReturnType<typeof getEquipmentGroupsFromCore>>;
type Leads = Awaited<ReturnType<typeof getLeadsFromCore>>;
type SupportDownloads = Awaited<ReturnType<typeof getAdminSupportDownloadsFromCore>>;
type Taxonomy = Awaited<ReturnType<typeof getTaxonomyFromCore>>;
type Navigation = Awaited<ReturnType<typeof getAdminNavigationFromCore>>;
type SiteProfile = Awaited<ReturnType<typeof getSiteProfileFromCore>>;
type PublishingConfig = Awaited<ReturnType<typeof getPublishingConfigFromCore>>;
type CatalogContent = Awaited<ReturnType<typeof getCatalogContentFromCore>>;
type ListingContent = Awaited<ReturnType<typeof getListingContentFromCore>>;
type ExternalLinks = Awaited<ReturnType<typeof getExternalLinksFromCore>>;
type Redirects = Awaited<ReturnType<typeof getRedirectsFromCore>>;
type Partners = Awaited<ReturnType<typeof getPartnersFromCore>>;
type Testimonials = Awaited<ReturnType<typeof getTestimonialsFromCore>>;
type AdminMedia = Awaited<ReturnType<typeof getAdminMediaFromCore>>;
type AuditLogs = Awaited<ReturnType<typeof getRecentAuditLogsFromCore>>;
type CmsUsers = Awaited<ReturnType<typeof getCmsUsersFromCore>>;

type DashboardPayload = { administrator: Administrator; analytics: AnalyticsOverview; readiness: PublishingReadiness; auditLogs: AuditLogs };
type EquipmentPayload = { equipment: Equipment; equipmentGroups: EquipmentGroups };
type SupportingPayload = { partners: Partners; testimonials: Testimonials };

function reviveDates(value: unknown, key = ""): unknown {
  if (typeof value === "string" && /(?:At|Date)$/.test(key) && !Number.isNaN(Date.parse(value))) return new Date(value);
  if (Array.isArray(value)) return value.map((item) => reviveDates(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, reviveDates(item, name)]));
  return value;
}

const getBackendJson = cache(async (path: string): Promise<unknown | null> => {
  const requestHeaders = await headers();
  const response = await fetch(`${backendUrl}${path}`, {
    headers: requestHeaders.get("cookie") ? { cookie: requestHeaders.get("cookie")! } : undefined,
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Không thể tải dữ liệu CMS từ Backend. Vui lòng thử lại.");
  return reviveDates(await response.json());
});

async function getData<T>(path: string): Promise<T | null> { return (await getBackendJson(path)) as T | null; }
async function getDashboard() { return getData<DashboardPayload>("/api/admin/dashboard"); }
async function getEquipmentPayload() { return getData<EquipmentPayload>("/api/admin/equipment"); }
async function getSupportingPayload() { return getData<SupportingPayload>("/api/admin/supporting"); }

export async function getCurrentAdministrator(_token?: string): Promise<Administrator | null> { return (await getDashboard())?.administrator ?? null; }
export async function getRequestAdministrator() { return getCurrentAdministrator(); }
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> { return (await getDashboard())?.analytics ?? { connection: "not_connected", periodDays: 7, visits: null }; }
export async function getPublishingReadiness(): Promise<PublishingReadiness> { return (await getDashboard())?.readiness ?? []; }
export async function getRecentAuditLogs(): Promise<AuditLogs> { return (await getDashboard())?.auditLogs ?? []; }

export async function getAdminOfferings(): Promise<AdminOfferings> { return (await getData<{ offerings: AdminOfferings }>("/api/admin/offerings"))?.offerings ?? []; }
export async function getAdminOfferingById(id: string) { return (await getAdminOfferings()).find((item) => item.id === id); }
export async function getAdminPages(): Promise<AdminPages> { return (await getData<{ pages: AdminPages }>("/api/admin/pages"))?.pages ?? []; }
export async function getAdminPosts(): Promise<AdminPosts> { return (await getData<{ posts: AdminPosts }>("/api/admin/posts"))?.posts ?? []; }
export async function getAdminPostById(id: string) { return (await getAdminPosts()).find((item) => item.id === id); }
export async function getEquipment(_publicOnly = false): Promise<Equipment> { return (await getEquipmentPayload())?.equipment ?? []; }
export async function getEquipmentGroups(): Promise<EquipmentGroups> { return (await getEquipmentPayload())?.equipmentGroups ?? []; }
export async function getLeads(): Promise<Leads> { return (await getData<{ leads: Leads }>("/api/admin/leads"))?.leads ?? []; }
export async function getAdminSupportDownloads(): Promise<SupportDownloads> { return (await getData<{ downloads: SupportDownloads }>("/api/admin/support-downloads"))?.downloads ?? []; }
export async function getTaxonomy(): Promise<Taxonomy> { return (await getData<{ taxonomy: Taxonomy }>("/api/admin/taxonomy"))?.taxonomy ?? { categories: [], tags: [] }; }
export async function getAdminNavigation(location = "header"): Promise<Navigation> { return (await getData<{ menu: Navigation }>(`/api/admin/navigation?location=${encodeURIComponent(location)}`))?.menu ?? { id: null, location: "header", version: 0, items: [] }; }
export async function getSiteProfile(): Promise<SiteProfile> { return (await getData<{ profile: SiteProfile }>("/api/admin/profile"))?.profile ?? null; }
export async function getPublishingConfig(): Promise<PublishingConfig> { return (await getData<{ config: PublishingConfig }>("/api/admin/publishing-config"))?.config ?? { siteUrl: null, defaultTitle: null, defaultDescription: null, defaultOgMediaId: null, allowSearchIndexing: false }; }
export async function getCatalogContent(): Promise<CatalogContent> { return (await getData<{ content: CatalogContent }>("/api/admin/catalog-content"))?.content ?? null; }
export async function getListingContent(): Promise<ListingContent> { return (await getData<{ content: ListingContent }>("/api/admin/listing-content"))?.content ?? null; }
export async function getExternalLinks(): Promise<ExternalLinks> { return (await getData<{ links: ExternalLinks }>("/api/admin/external-links"))?.links ?? null; }
export async function getRedirects(): Promise<Redirects> { return (await getData<{ redirects: Redirects }>("/api/admin/redirects"))?.redirects ?? []; }
export async function getPartners(_enabledOnly = false): Promise<Partners> { return (await getSupportingPayload())?.partners ?? []; }
export async function getTestimonials(_enabledOnly = false): Promise<Testimonials> { return (await getSupportingPayload())?.testimonials ?? []; }
export async function getAdminMedia(): Promise<AdminMedia> { return (await getData<{ assets: AdminMedia }>("/api/admin/media"))?.assets ?? []; }
export async function getCmsUsers(): Promise<CmsUsers> { return (await getData<{ users: CmsUsers }>("/api/admin/users"))?.users ?? []; }
