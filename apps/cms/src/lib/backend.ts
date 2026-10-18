import { headers } from "next/headers";
import { createAdminListPageSchema } from "@iorder/core/server/shared/admin-list.contract";
import { supportDownloadListResponseSchema } from "@iorder/core/server/support/support-downloads.contract";
import { adminPostListItemSchema, adminPostSchema, publicPostTypeSchema } from "@iorder/core/server/posts/posts.contract";
import { adminOfferingListItemSchema, adminOfferingSchema, publicOfferingTypeSchema } from "@iorder/core/server/offerings/offering-content.contract";
import { adminPageSchema, adminPagesPageSchema, pageListQuerySchema } from "@iorder/core/server/pages/pages.contract";
import type { z } from "zod";
import { parseAdminDetailPayload } from "./admin-detail-payload";
import { cache } from "react";
import { mediaListQuerySchema, mediaListResponseSchema, type MediaListQuery } from "@iorder/core/server/media/media.contract";
import { cmsUserListPageSchema, cmsUserListQuerySchema, cmsUserRoleOptionsSchema, type CmsUserListQuery } from "@iorder/core/server/users/users.contract";
import { cmsRoleListSchema } from "@iorder/core/server/roles/roles.contract";
import type { CmsAction } from "@iorder/core/server/auth/permissions";
import type { MatrixModule } from "@/components/admin/ui/role-permission-matrix";
import { partnerListPageSchema, partnerListQuerySchema, testimonialListPageSchema, testimonialListQuerySchema, type PartnerListQuery, type TestimonialListQuery } from "@iorder/core/server/supporting/supporting.contract";

import type { getAnalyticsOverview as getAnalyticsOverviewFromCore } from "@iorder/core/server/analytics/analytics.service";
import type { getDashboardContentSummary as getDashboardContentSummaryFromCore } from "@iorder/core/server/dashboard/dashboard-content.service";
import type { getRequestAdministrator as getRequestAdministratorFromCore } from "@iorder/core/server/auth/request-administrator";
import type { getRecentAuditLogs as getRecentAuditLogsFromCore } from "@iorder/core/server/audit/audit.service";
import type { getAuditLogsPage as getAuditLogsPageFromCore } from "@iorder/core/server/audit/audit.service";
import { auditListPageSchema, auditListQuerySchema, type AuditListQuery } from "@iorder/core/server/audit/audit.contract";
import type { getEquipment as getEquipmentFromCore, getEquipmentGroups as getEquipmentGroupsFromCore } from "@iorder/core/server/equipment/equipment.service";
import type { getEquipmentPage as getEquipmentPageFromCore } from "@iorder/core/server/equipment/equipment.service";
import type { getLeadsPage as getLeadsPageFromCore } from "@iorder/core/server/leads/leads.service";
import { leadListPageSchema, leadListQuerySchema, type LeadListQuery } from "@iorder/core/server/leads/leads.contract";
import type { getAdminMedia as getAdminMediaFromCore } from "@iorder/core/server/media/media.service";
import type { getAdminNavigation as getAdminNavigationFromCore } from "@iorder/core/server/navigation/navigation.service";
import type { getPublishedNavigationTargets as getPublishedNavigationTargetsFromCore } from "@iorder/core/server/navigation/navigation.service";
import type { getAdminOfferings as getAdminOfferingsFromCore } from "@iorder/core/server/offerings/offerings.service";
import type { getAdminOfferingSummariesPage as getAdminOfferingsPageFromCore } from "@iorder/core/server/offerings/offerings.service";
import type { getAdminPages as getAdminPagesFromCore } from "@iorder/core/server/pages/pages.service";
import type { getAdminPagesPage as getAdminPagesPageFromCore } from "@iorder/core/server/pages/pages.service";
import type { getAdminPosts as getAdminPostsFromCore } from "@iorder/core/server/posts/posts.service";
import type { getAdminPostSummariesPage as getAdminPostsPageFromCore } from "@iorder/core/server/posts/posts.service";
import type { getAdminNotifications as getAdminNotificationsFromCore } from "@iorder/core/server/dashboard/notifications.service";
import type { getPublishingReadiness as getPublishingReadinessFromCore } from "@iorder/core/server/publishing-readiness/publishing-readiness.service";
import type { getRedirects as getRedirectsFromCore } from "@iorder/core/server/redirects/redirects.service";
import type { getExternalLinks as getExternalLinksFromCore } from "@iorder/core/server/settings/external-links.service";
import type { getSiteProfile as getSiteProfileFromCore } from "@iorder/core/server/settings/profile.service";
import type { getPublishingConfig as getPublishingConfigFromCore } from "@iorder/core/server/settings/publishing.service";
import type { getAdminSupportDownloads as getAdminSupportDownloadsFromCore } from "@iorder/core/server/support/support-downloads.service";
import type { getTaxonomy as getTaxonomyFromCore } from "@iorder/core/server/taxonomy/taxonomy.service";
import { logger, normalizeRequestId, requestIdHeader } from "@iorder/core/server/shared/logger";

const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3002").replace(/\/$/, "");
export const administratorSessionCookieName = "iorder_admin_session";

type Administrator = NonNullable<Awaited<ReturnType<typeof getRequestAdministratorFromCore>>>;
type AnalyticsOverview = Awaited<ReturnType<typeof getAnalyticsOverviewFromCore>>;
type DashboardContentSummary = Awaited<ReturnType<typeof getDashboardContentSummaryFromCore>>;
type PublishingReadiness = Awaited<ReturnType<typeof getPublishingReadinessFromCore>>;
type AdminNotifications = Awaited<ReturnType<typeof getAdminNotificationsFromCore>>;
type AdminOfferings = Awaited<ReturnType<typeof getAdminOfferingsFromCore>>;
type AdminOfferingsPage = Awaited<ReturnType<typeof getAdminOfferingsPageFromCore>>;
type AdminPages = Awaited<ReturnType<typeof getAdminPagesFromCore>>;
type AdminPagesPage = Awaited<ReturnType<typeof getAdminPagesPageFromCore>>;
type AdminPosts = Awaited<ReturnType<typeof getAdminPostsFromCore>>;
type AdminPostsPage = Awaited<ReturnType<typeof getAdminPostsPageFromCore>>;
type Equipment = Awaited<ReturnType<typeof getEquipmentFromCore>>;
type EquipmentPage = Awaited<ReturnType<typeof getEquipmentPageFromCore>>;
type EquipmentGroups = Awaited<ReturnType<typeof getEquipmentGroupsFromCore>>;
type LeadsPage = Awaited<ReturnType<typeof getLeadsPageFromCore>>;
type SupportDownloads = Awaited<ReturnType<typeof getAdminSupportDownloadsFromCore>>;
type Taxonomy = Awaited<ReturnType<typeof getTaxonomyFromCore>>;
type Navigation = Awaited<ReturnType<typeof getAdminNavigationFromCore>>;
type NavigationTargets = Awaited<ReturnType<typeof getPublishedNavigationTargetsFromCore>>;
type SiteProfile = Awaited<ReturnType<typeof getSiteProfileFromCore>>;
type PublishingConfig = Awaited<ReturnType<typeof getPublishingConfigFromCore>>;
type ExternalLinks = Awaited<ReturnType<typeof getExternalLinksFromCore>>;
type Redirects = Awaited<ReturnType<typeof getRedirectsFromCore>>;
type AdminMedia = Awaited<ReturnType<typeof getAdminMediaFromCore>>;
type AuditLogs = Awaited<ReturnType<typeof getRecentAuditLogsFromCore>>;
const emptyContentStat = { missingSeo: 0, pending: 0, published: 0, scheduled: 0, total: 0 };

type DashboardPayload = { administrator: Administrator; analytics: AnalyticsOverview; readiness: PublishingReadiness; auditLogs: AuditLogs; content: DashboardContentSummary };
type EquipmentPayload = { result: EquipmentPage; equipmentGroups: EquipmentGroups };
type EquipmentGroupsPayload = { equipmentGroups: EquipmentGroups };

function reviveDates(value: unknown, key = ""): unknown {
  if (typeof value === "string" && /(?:At|Date)$/.test(key) && !Number.isNaN(Date.parse(value))) return new Date(value);
  if (Array.isArray(value)) return value.map((item) => reviveDates(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, reviveDates(item, name)]));
  return value;
}

// null: 401/403 (chưa đăng nhập hoặc thiếu quyền module); undefined: 404 (không có bản ghi).
const getBackendJson = cache(async (path: string): Promise<unknown | null | undefined> => {
  const requestHeaders = await headers();
  const forwarded: Record<string, string> = {};
  const cookie = requestHeaders.get("cookie");
  if (cookie) forwarded.cookie = cookie;
  // Cùng mã request với trang CMS đang render để nối log CMS ↔ Backend.
  const requestId = normalizeRequestId(requestHeaders.get(requestIdHeader));
  if (requestId) forwarded[requestIdHeader] = requestId;
  const backendPath = path.split("?")[0];
  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, { headers: forwarded, cache: "no-store" });
  } catch (error) {
    logger.error("Không kết nối được Backend.", { requestId: requestId ?? undefined, backendPath, error });
    throw new Error("Không thể tải dữ liệu CMS từ Backend. Vui lòng thử lại.");
  }
  // 401: not signed in; 403: the role lacks this module. Pages fall back to empty
  // data instead of crashing; the API stays the authority.
  if (response.status === 401 || response.status === 403) return null;
  if (response.status === 404) return undefined;
  if (!response.ok) {
    logger.error("Backend trả lỗi khi CMS tải dữ liệu.", { requestId: requestId ?? undefined, backendPath, status: response.status });
    throw new Error("Không thể tải dữ liệu CMS từ Backend. Vui lòng thử lại.");
  }
  return reviveDates(await response.json());
});

async function getData<T>(path: string): Promise<T | null | undefined> { return (await getBackendJson(path)) as T | null | undefined; }
// Chi tiết theo id: 404 → undefined để trang gọi notFound(); phản hồi lạ vẫn báo lỗi.
async function getDetail<S extends z.ZodType<{ id: string }>>(path: string, key: string, schema: S, id: string): Promise<z.output<S> | undefined> {
  const payload = await getData<unknown>(path);
  return payload === undefined ? undefined : parseAdminDetailPayload(payload, key, schema as unknown as z.ZodType<z.output<S>>, id);
}
async function getDashboard() { return getData<DashboardPayload>("/api/admin/dashboard"); }
async function getEquipmentPayload(query = "") { return getData<EquipmentPayload>(`/api/admin/equipment${query}`); }
async function getEquipmentGroupsPayload() { return getData<EquipmentGroupsPayload>("/api/admin/equipment?groupsOnly=1"); }

export async function getCurrentAdministrator(token?: string): Promise<Administrator | null> { void token; return (await getData<{ administrator: Administrator }>("/api/admin/session"))?.administrator ?? null; }
export async function getRequestAdministrator() { return getCurrentAdministrator(); }
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> { return (await getDashboard())?.analytics ?? { connection: "not_connected", periodDays: 7 }; }
// Chuông thông báo: endpoint nhẹ, không tải cả dashboard ở mỗi lần điều hướng.
// Chuông thông báo là phần phụ của layout: lỗi ở đây không được làm hỏng mọi trang CMS.
export async function getAdminNotifications(): Promise<AdminNotifications> {
  try {
    return (await getData<{ notifications: AdminNotifications }>("/api/admin/notifications"))?.notifications ?? [];
  } catch {
    return [];
  }
}
export async function getPublishingReadiness(): Promise<PublishingReadiness> { return (await getDashboard())?.readiness ?? []; }
export async function getRecentAuditLogs(): Promise<AuditLogs> { return (await getDashboard())?.auditLogs ?? []; }
export async function getAuditLogsPage(input: AuditListQuery): Promise<Awaited<ReturnType<typeof getAuditLogsPageFromCore>>> {
  const query = auditListQuerySchema.parse(input);
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
  const data = await getData<{ result: Awaited<ReturnType<typeof getAuditLogsPageFromCore>> }>(`/api/admin/audit?${params}`);
  if (!data?.result || !Array.isArray(data.result.items)) throw new Error("Không tải được nhật ký. Vui lòng đăng nhập lại hoặc thử lại.");
  const parsed = auditListPageSchema.safeParse(data.result);
  if (!parsed.success || parsed.data.page !== query.page || parsed.data.pageSize !== query.pageSize || (query.entityType && parsed.data.items.some(row => row.entityType !== query.entityType))) throw new Error("Dữ liệu phân trang nhật ký không hợp lệ. Vui lòng thử lại.");
  return parsed.data;
}
export async function getDashboardContentSummary(): Promise<DashboardContentSummary> { return (await getDashboard())?.content ?? { pages: emptyContentStat, posts: emptyContentStat, offerings: { products: emptyContentStat, solutions: emptyContentStat, services: emptyContentStat }, equipment: emptyContentStat, downloads: { enabled: 0, total: 0 }, leads: { new: 0, total: 0 }, recent: [] }; }

export async function getAdminOfferings(): Promise<AdminOfferings> {
  const payload = await getData<{ result: unknown }>("/api/admin/offerings?pageSize=100");
  const parsed = createAdminListPageSchema(adminOfferingSchema).safeParse(payload?.result);
  if (!parsed.success) throw new Error("Phản hồi danh sách nội dung không hợp lệ. Vui lòng tải lại.");
  return parsed.data.items;
}
export async function getAdminOfferingsPage(params: { page?: string | number; pageSize?: string | number; query?: string; status?: string; type?: string } = {}): Promise<AdminOfferingsPage> {
  const input = pageListQuerySchema.extend({ type: publicOfferingTypeSchema.optional() }).parse({ ...params, status: params.status || undefined, type: params.type || undefined });
  const query = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  query.set("view", "summary");
  const payload = await getData<{ result: unknown }>(`/api/admin/offerings?${query.toString()}`);
  const parsed = createAdminListPageSchema(adminOfferingListItemSchema).safeParse(payload?.result);
  if (!parsed.success || parsed.data.page !== input.page || parsed.data.pageSize !== input.pageSize || parsed.data.items.some(item => (input.status && item.status !== input.status) || (input.type && item.type !== input.type))) throw new Error("Phản hồi danh sách sản phẩm, giải pháp hoặc dịch vụ không hợp lệ. Vui lòng thử lại.");
  return parsed.data;
}
export async function getAdminOfferingById(id: string) { return getDetail(`/api/admin/offerings/${encodeURIComponent(id)}`, "offering", adminOfferingSchema, id); }
export async function getAdminPages(): Promise<AdminPages> { return (await getAdminPagesPage())?.items ?? []; }
export async function getAdminPagesPage(params: { page?: string | number; pageSize?: string | number; query?: string; status?: string } = {}): Promise<AdminPagesPage> {
  const input = pageListQuerySchema.parse({ ...params, status: params.status || undefined });
  const query = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  const payload = await getData<{ result: unknown }>(`/api/admin/pages?${query.toString()}`);
  const parsed = adminPagesPageSchema.safeParse(payload?.result);
  if (!parsed.success || parsed.data.page !== input.page || parsed.data.pageSize !== input.pageSize || (input.status && parsed.data.items.some(page => page.status !== input.status))) throw new Error("Phản hồi danh sách trang không hợp lệ. Vui lòng thử lại.");
  return parsed.data;
}
// Trang hệ thống theo slug (ví dụ trang danh sách mở từ module). null: chưa tạo hoặc không có quyền xem.
export async function getAdminSystemPageBySlug(slug: string) {
  const payload = await getData<{ page: unknown }>(`/api/admin/pages?slug=${encodeURIComponent(slug)}`);
  if (!payload?.page) return null;
  const parsed = adminPageSchema.safeParse(payload.page);
  if (!parsed.success || parsed.data.slug !== slug) throw new Error("Phản hồi trang hệ thống không hợp lệ. Vui lòng tải lại.");
  return parsed.data;
}
export async function getAdminPageById(id: string) { return getDetail(`/api/admin/pages/${encodeURIComponent(id)}`, "page", adminPageSchema, id); }
export async function getAdminPosts(): Promise<AdminPosts> {
  const payload = await getData<{ result: unknown }>("/api/admin/posts?pageSize=100");
  const parsed = createAdminListPageSchema(adminPostSchema).safeParse(payload?.result);
  if (!parsed.success) throw new Error("Phản hồi danh sách bài viết không hợp lệ. Vui lòng tải lại.");
  return parsed.data.items;
}
export async function getAdminPostsPage(params: { excludeType?: string; page?: string | number; pageSize?: string | number; query?: string; status?: string; type?: string } = {}): Promise<AdminPostsPage> {
  const input = pageListQuerySchema.extend({ type: publicPostTypeSchema.optional(), excludeType: publicPostTypeSchema.optional() }).parse({ ...params, status: params.status || undefined, type: params.type || undefined, excludeType: params.excludeType || undefined });
  const query = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  query.set("view", "summary");
  const payload = await getData<{ result: unknown }>(`/api/admin/posts?${query.toString()}`);
  const parsed = createAdminListPageSchema(adminPostListItemSchema).safeParse(payload?.result);
  if (!parsed.success || parsed.data.page !== input.page || parsed.data.pageSize !== input.pageSize || parsed.data.items.some(item => (input.status && item.status !== input.status) || (input.type && item.type !== input.type) || (input.excludeType && item.type === input.excludeType))) throw new Error("Phản hồi danh sách bài viết không hợp lệ. Vui lòng thử lại.");
  return parsed.data;
}
export async function getAdminPostById(id: string) { return getDetail(`/api/admin/posts/${encodeURIComponent(id)}`, "post", adminPostSchema, id); }
export async function getEquipment(publicOnly = false): Promise<Equipment> { void publicOnly; return (await getEquipmentPage({ pageSize: 100 })).items; }
export async function getEquipmentPage(params: { groupId?: string; page?: string | number; pageSize?: string | number; query?: string; status?: string } = {}): Promise<EquipmentPage> {
  return (await getEquipmentPageWithGroups(params)).result;
}
export async function getEquipmentPageWithGroups(params: { groupId?: string; page?: string | number; pageSize?: string | number; query?: string; status?: string } = {}): Promise<EquipmentPayload> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  return (await getEquipmentPayload(`?${query.toString()}`)) ?? { result: { items: [], page: 1, pageSize: 25, total: 0, totalPages: 1 }, equipmentGroups: [] };
}
export async function getEquipmentById(id: string): Promise<Equipment[number] | undefined> { return (await getData<{ equipment: Equipment[number] }>(`/api/admin/equipment/${encodeURIComponent(id)}`))?.equipment; }
export async function getEquipmentGroups(): Promise<EquipmentGroups> { return (await getEquipmentGroupsPayload())?.equipmentGroups ?? []; }
export async function getLeadsPage(input: LeadListQuery): Promise<LeadsPage> {
  const query = leadListQuerySchema.parse(input);
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
  const data = await getData<{ result: LeadsPage }>(`/api/admin/leads?${params}`);
  if (!data?.result || !Array.isArray(data.result.items)) throw new Error("Không tải được danh sách liên hệ. Vui lòng đăng nhập lại hoặc thử lại.");
  const parsed = leadListPageSchema.safeParse(data.result);
  if (!parsed.success || parsed.data.total !== parsed.data.counts[query.status] || parsed.data.page !== query.page || parsed.data.pageSize !== query.pageSize || (query.status !== "all" && parsed.data.items.some(row => row.status !== query.status))) throw new Error("Dữ liệu phân trang liên hệ không hợp lệ. Vui lòng thử lại.");
  return parsed.data;
}
export async function getAdminSupportDownloads(): Promise<SupportDownloads> {
  const parsed = supportDownloadListResponseSchema.safeParse(await getData<unknown>("/api/admin/support-downloads"));
  if (!parsed.success) throw new Error("Phản hồi danh sách tài nguyên không hợp lệ. Vui lòng tải lại.");
  return parsed.data.downloads;
}
export async function getTaxonomy(): Promise<Taxonomy> { return (await getData<{ taxonomy: Taxonomy }>("/api/admin/taxonomy"))?.taxonomy ?? { categories: [], tags: [] }; }
export async function getAdminNavigation(location = "header"): Promise<Navigation> { return (await getData<{ menu: Navigation }>(`/api/admin/navigation?location=${encodeURIComponent(location)}`))?.menu ?? { id: null, location: "header", version: 0, items: [] }; }
export async function getPublishedNavigationTargets(): Promise<NavigationTargets> { return (await getData<{ targets: NavigationTargets }>("/api/admin/navigation/targets"))?.targets ?? []; }
export async function getSiteProfile(): Promise<SiteProfile> { return (await getData<{ profile: SiteProfile }>("/api/admin/profile"))?.profile ?? null; }
export async function getPublishingConfig(): Promise<PublishingConfig> { return (await getData<{ config: PublishingConfig }>("/api/admin/publishing-config"))?.config ?? { siteUrl: null, defaultTitle: null, defaultDescription: null, defaultOgMediaId: null, allowSearchIndexing: false }; }
export async function getExternalLinks(): Promise<ExternalLinks> { return (await getData<{ links: ExternalLinks }>("/api/admin/external-links"))?.links ?? null; }
// Phiên bản dữ liệu cấu hình cho optimistic concurrency; dùng lại response đã cache ở cùng request.
async function getSettingVersion(path: string) { const version = (await getData<{ version?: unknown }>(path))?.version; return typeof version === "number" ? version : 0; }
export async function getSiteProfileVersion() { return getSettingVersion("/api/admin/profile"); }
export async function getPublishingConfigVersion() { return getSettingVersion("/api/admin/publishing-config"); }
export async function getExternalLinksVersion() { return getSettingVersion("/api/admin/external-links"); }
export async function getRedirects(): Promise<Redirects> { return (await getData<{ redirects: Redirects }>("/api/admin/redirects"))?.redirects ?? []; }
export async function getPartnersPage(input: PartnerListQuery) {
  const query = partnerListQuerySchema.parse(input);
  const params = new URLSearchParams({ kind: "partners", ...Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])) });
  const data = await getData<{ kind: string; result: unknown }>(`/api/admin/supporting?${params}`);
  const parsed = partnerListPageSchema.safeParse(data?.result);
  if (data?.kind !== "partners" || !parsed.success || parsed.data.page !== query.page || parsed.data.pageSize !== query.pageSize || parsed.data.items.some(row => (query.visibility !== "all" && row.isEnabled !== (query.visibility === "enabled")) || (query.partnerKind !== "all" && row.kind !== query.partnerKind))) {
    throw new Error("Không tải được trang đối tác hợp lệ. Vui lòng đăng nhập lại hoặc thử lại.");
  }
  return parsed.data;
}
export async function getTestimonialsPage(input: TestimonialListQuery) {
  const query = testimonialListQuerySchema.parse(input);
  const params = new URLSearchParams({ kind: "testimonials", ...Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])) });
  const data = await getData<{ kind: string; result: unknown }>(`/api/admin/supporting?${params}`);
  const parsed = testimonialListPageSchema.safeParse(data?.result);
  if (data?.kind !== "testimonials" || !parsed.success || parsed.data.page !== query.page || parsed.data.pageSize !== query.pageSize || parsed.data.items.some(row => query.visibility !== "all" && row.isEnabled !== (query.visibility === "enabled"))) {
    throw new Error("Không tải được trang đánh giá hợp lệ. Vui lòng đăng nhập lại hoặc thử lại.");
  }
  return parsed.data;
}
export async function getAdminMediaPage(input: Partial<MediaListQuery> = {}) {
  const query = mediaListQuerySchema.parse({ ...input, pageSize: 25 });
  const params = new URLSearchParams({ page: String(query.page), pageSize: "25", type: query.type, query: query.query });
  const result = await getData<{ assets: AdminMedia; page: number; pageSize: number; total: number; totalPages: number }>(`/api/admin/media?${params}`);
  if (!result) throw new Error("Không tải được trang thư viện tệp.");
  const parsed = mediaListResponseSchema.safeParse(result);
  if (!parsed.success) throw new Error("Dữ liệu trang thư viện tệp không hợp lệ.");
  return parsed.data;
}
export async function getCmsUsersPage(input: CmsUserListQuery) {
  const query = cmsUserListQuerySchema.parse(input);
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
  const data = await getData<{ result: unknown; roles: unknown }>(`/api/admin/users?${params}`);
  const parsed = cmsUserListPageSchema.safeParse(data?.result);
  if (!parsed.success || parsed.data.page !== query.page || parsed.data.pageSize !== query.pageSize || parsed.data.items.some(user => (query.status !== "all" && user.status !== query.status) || (query.role !== "all" && user.role !== query.role))) {
    throw new Error("Không tải được trang tài khoản hợp lệ. Vui lòng đăng nhập lại hoặc thử lại.");
  }
  const roles = cmsUserRoleOptionsSchema.safeParse(data?.roles);
  if (!roles.success) throw new Error("Không tải được danh sách vai trò. Vui lòng thử lại.");
  return { page: parsed.data, roles: roles.data };
}

export async function getCmsRolesPayload() {
  const data = await getData<{ roles: unknown; modules: unknown; actionLabels: unknown }>("/api/admin/roles");
  const roles = cmsRoleListSchema.safeParse(data?.roles);
  if (!roles.success || !Array.isArray(data?.modules) || !data?.actionLabels || typeof data.actionLabels !== "object") {
    throw new Error("Không tải được danh sách vai trò. Vui lòng đăng nhập lại hoặc thử lại.");
  }
  return { roles: roles.data, modules: data.modules as MatrixModule[], actionLabels: data.actionLabels as Record<CmsAction, string> };
}
