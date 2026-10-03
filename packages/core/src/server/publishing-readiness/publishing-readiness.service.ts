import { and, count, eq, isNull } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { equipmentGroups, offerings, pages, partners, posts, salesEquipment, supportDownloads, testimonials } from "@iorder/core/db/schema";
import { getNavigation } from "@iorder/core/server/navigation/navigation.service";
import { getSiteProfile } from "@iorder/core/server/settings/profile.service";
import { getPublishingConfig } from "@iorder/core/server/settings/publishing.service";
import { getExternalLinks } from "@iorder/core/server/settings/external-links.service";

type ReadinessStatus = "ready" | "attention";

export type PublishingReadinessItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  status: ReadinessStatus;
};

async function publishedCount(table: typeof pages | typeof offerings | typeof posts | typeof salesEquipment) {
  const [result] = await getDb().select({ total: count() }).from(table).where(and(eq(table.status, "published"), isNull(table.deletedAt)));
  return result?.total ?? 0;
}

async function publishedOfferingCount(type: "software" | "solution" | "service") {
  const [result] = await getDb()
    .select({ total: count() })
    .from(offerings)
    .where(and(eq(offerings.status, "published"), eq(offerings.type, type), isNull(offerings.deletedAt)));
  return result?.total ?? 0;
}

async function enabledCount(table: typeof equipmentGroups | typeof partners | typeof testimonials | typeof supportDownloads) {
  const [result] = await getDb().select({ total: count() }).from(table).where(table === equipmentGroups ? and(eq(table.isEnabled, true), isNull(table.deletedAt)) : eq(table.isEnabled, true));
  return result?.total ?? 0;
}

export async function getPublishingReadiness(): Promise<PublishingReadinessItem[]> {
  const [config, profile, externalLinks, header, footer, publishedPages, publishedProducts, publishedSolutions, publishedServices, publishedPosts, equipment, equipmentGroupsCount, partnerCount, testimonialCount, downloadCount] = await Promise.all([
    getPublishingConfig(),
    getSiteProfile(),
    getExternalLinks(),
    getNavigation("header"),
    getNavigation("footer"),
    publishedCount(pages),
    publishedOfferingCount("software"),
    publishedOfferingCount("solution"),
    publishedOfferingCount("service"),
    publishedCount(posts),
    publishedCount(salesEquipment),
    enabledCount(equipmentGroups),
    enabledCount(partners),
    enabledCount(testimonials),
    enabledCount(supportDownloads),
  ]);

  return [
    { id: "site-url", label: "Tên miền website", detail: config.siteUrl ? `Đã cấu hình: ${config.siteUrl}` : "Chưa cấu hình URL chính thức; sitemap và canonical chưa thể xuất bản.", href: "/admin/seo", status: config.siteUrl ? "ready" : "attention" },
    { id: "indexing", label: "Cho phép lập chỉ mục", detail: config.allowSearchIndexing ? "Robot tìm kiếm được phép lập chỉ mục." : "Đang tắt lập chỉ mục; phù hợp development nhưng cần bật khi website chính thức sẵn sàng.", href: "/admin/seo", status: config.allowSearchIndexing ? "ready" : "attention" },
    { id: "profile", label: "Hồ sơ doanh nghiệp", detail: profile?.companyName ? `${profile.companyName}${profile.hotline || profile.supportEmail || profile.salesEmail ? " đã có kênh liên hệ." : "Chưa có số điện thoại hoặc email liên hệ."}` : "Chưa tạo hồ sơ doanh nghiệp.", href: "/admin/thong-tin-doanh-nghiep", status: profile?.companyName && Boolean(profile.hotline || profile.supportEmail || profile.salesEmail) ? "ready" : "attention" },
    { id: "external-links", label: "Liên kết ngoài", detail: `${externalLinks ? Object.values(externalLinks).filter(Boolean).length : 0} liên kết đang hiển thị ở chân trang.`, href: "/admin/lien-ket-ngoai", status: externalLinks && Object.values(externalLinks).some(Boolean) ? "ready" : "attention" },
    { id: "navigation", label: "Điều hướng website", detail: `Header: ${header?.filter(item => item.isEnabled).length ?? 0} mục; footer: ${footer?.filter(item => item.isEnabled).length ?? 0} mục.`, href: "/admin/menu", status: (header?.some(item => item.isEnabled) ?? false) && (footer?.some(item => item.isEnabled) ?? false) ? "ready" : "attention" },
    { id: "pages", label: "Trang CMS", detail: `${publishedPages} trang đã publish.`, href: "/admin/pages", status: publishedPages > 0 ? "ready" : "attention" },
    { id: "products", label: "Sản phẩm", detail: `${publishedProducts} sản phẩm đã publish.`, href: "/admin/san-pham", status: publishedProducts > 0 ? "ready" : "attention" },
    { id: "solutions", label: "Giải pháp", detail: `${publishedSolutions} giải pháp đã publish.`, href: "/admin/giai-phap", status: publishedSolutions > 0 ? "ready" : "attention" },
    { id: "services", label: "Dịch vụ", detail: `${publishedServices} dịch vụ đã publish.`, href: "/admin/dich-vu", status: publishedServices > 0 ? "ready" : "attention" },
    { id: "posts", label: "Tin tức và hướng dẫn", detail: `${publishedPosts} bài viết đã publish.`, href: "/admin/tin-tuc", status: publishedPosts > 0 ? "ready" : "attention" },
    { id: "equipment", label: "Thiết bị", detail: `${equipmentGroupsCount} nhóm và ${equipment} thiết bị đang hiển thị.`, href: "/admin/thiet-bi", status: equipmentGroupsCount > 0 && equipment > 0 ? "ready" : "attention" },
    { id: "supporting", label: "Đối tác, đánh giá và tệp hỗ trợ", detail: `${partnerCount} đối tác, ${testimonialCount} đánh giá, ${downloadCount} tệp hỗ trợ đang hiển thị.`, href: "/admin/doi-tac", status: testimonialCount > 0 && downloadCount > 0 ? "ready" : "attention" },
  ];
}
