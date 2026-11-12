import { and, desc, ilike, isNull, or } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import {
  categories,
  mediaAssets,
  menuItems,
  offerings,
  pages,
  partners,
  posts,
  redirects,
  salesEquipment,
  supportDownloads,
  tags,
  testimonials,
} from "@iorder/shared/db/schema";
import { hasCmsPermission, type CmsActor, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";

export type GlobalSearchResult = { href: string; id: string; label: string; slug: string; type: string };

type CmsRoute = GlobalSearchResult & { permission?: CmsPermissionCode };

const resultsPerKind = 4;
const cmsRoutes: CmsRoute[] = [
  { id: "overview", label: "Bảng điều khiển", slug: "/admin", type: "Điều hướng CMS", href: "/admin" },
  { id: "analytics", label: "Thống kê truy cập", slug: "/admin/analytics", type: "Điều hướng CMS", href: "/admin/analytics", permission: "dashboard.view" },
  { id: "home-page", label: "Trang chủ", slug: "/admin/homepage", type: "Điều hướng CMS", href: "/admin/homepage", permission: "pages.view" },
  { id: "pages", label: "Trang tĩnh", slug: "/admin/pages", type: "Điều hướng CMS", href: "/admin/pages", permission: "pages.view" },
  { id: "posts", label: "Bài viết & Tin tức", slug: "/admin/news", type: "Điều hướng CMS", href: "/admin/news", permission: "posts.view" },
  { id: "downloads", label: "Tệp cài đặt", slug: "/admin/resources", type: "Điều hướng CMS", href: "/admin/resources", permission: "support_downloads.view" },
  { id: "guides", label: "Hướng dẫn sử dụng", slug: "/admin/guides", type: "Điều hướng CMS", href: "/admin/guides", permission: "posts.view" },
  { id: "media", label: "Thư viện media", slug: "/admin/media", type: "Điều hướng CMS", href: "/admin/media", permission: "media.view" },
  { id: "products", label: "Sản phẩm & Dịch vụ", slug: "/admin/products", type: "Điều hướng CMS", href: "/admin/products", permission: "offerings.view" },
  { id: "solutions", label: "Giải pháp", slug: "/admin/solutions", type: "Điều hướng CMS", href: "/admin/products?type=solution", permission: "offerings.view" },
  { id: "services", label: "Dịch vụ", slug: "/admin/services", type: "Điều hướng CMS", href: "/admin/products?type=service", permission: "offerings.view" },
  { id: "equipment", label: "Thiết bị", slug: "/admin/equipment", type: "Điều hướng CMS", href: "/admin/equipment", permission: "equipment.view" },
  { id: "equipment-groups", label: "Nhóm thiết bị", slug: "/admin/equipment?tab=groups", type: "Điều hướng CMS", href: "/admin/equipment?tab=groups", permission: "equipment.view" },
  { id: "menu", label: "Menu & Điều hướng", slug: "/admin/menu", type: "Điều hướng CMS", href: "/admin/menu", permission: "navigation.view" },
  { id: "taxonomy", label: "Chuyên mục & Thẻ", slug: "/admin/taxonomy", type: "Điều hướng CMS", href: "/admin/taxonomy", permission: "taxonomy.view" },
  { id: "seo", label: "Tên miền & SEO", slug: "/admin/seo", type: "Điều hướng CMS", href: "/admin/seo", permission: "settings.view" },
  { id: "redirects", label: "Chuyển hướng URL", slug: "/admin/redirects", type: "Điều hướng CMS", href: "/admin/redirects", permission: "redirects.view" },
  { id: "external-links", label: "Liên kết & Mạng xã hội", slug: "/admin/external-links", type: "Điều hướng CMS", href: "/admin/external-links", permission: "settings.view" },
  { id: "company", label: "Thông tin doanh nghiệp", slug: "/admin/company-profile", type: "Điều hướng CMS", href: "/admin/company-profile", permission: "settings.view" },
  { id: "partners", label: "Đối tác & Đánh giá", slug: "/admin/partners", type: "Điều hướng CMS", href: "/admin/partners", permission: "supporting.view" },
  { id: "leads", label: "Khách hàng tiềm năng", slug: "/admin/leads", type: "Điều hướng CMS", href: "/admin/leads", permission: "leads.view" },
  { id: "users", label: "Người dùng CMS", slug: "/admin/users", type: "Điều hướng CMS", href: "/admin/users", permission: "users.view" },
  { id: "roles", label: "Vai trò & quyền", slug: "/admin/users?tab=roles", type: "Điều hướng CMS", href: "/admin/users?tab=roles", permission: "roles.view" },
  { id: "audit", label: "Nhật ký hoạt động", slug: "/admin/audit-log", type: "Điều hướng CMS", href: "/admin/audit-log", permission: "audit.view" },
  { id: "publishing", label: "Kiểm tra xuất bản", slug: "/admin/seo/publish-check", type: "Điều hướng CMS", href: "/admin/seo/publish-check", permission: "settings.view" },
  { id: "appearance", label: "Giao diện CMS", slug: "/admin/appearance", type: "Điều hướng CMS", href: "/admin/appearance" },
];

// Đường dẫn CMS là tiếng Anh, nên tìm màn hình bằng tiếng Việt không dấu ("khach hang") phải khớp được với nhãn có dấu.
function foldVietnamese(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/-/g, " ").toLocaleLowerCase("vi");
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function containsAny(keyword: string, ...fields: Parameters<typeof ilike>[0][]) {
  const pattern = `%${escapeLike(keyword)}%`;
  return or(...fields.map((field) => ilike(field, pattern)));
}

function rank(result: GlobalSearchResult, keyword: string) {
  const label = result.label.toLocaleLowerCase("vi");
  const slug = result.slug.toLocaleLowerCase("vi");
  if (slug === keyword) return 0;
  if (slug.startsWith(keyword)) return 1;
  if (label.startsWith(keyword)) return 2;
  return 3;
}

/**
 * Tìm trực tiếp theo từng bảng, không nạp toàn bộ nội dung CMS vào bộ nhớ.
 * Chỉ truy vấn module mà người dùng có quyền xem, để không lộ tiêu đề bản nháp.
 */
export async function searchAdminCms(rawKeyword: string, actor: CmsActor, limit = 12): Promise<GlobalSearchResult[]> {
  const keyword = rawKeyword.trim().toLocaleLowerCase("vi").slice(0, 120);
  if (keyword.length < 2) return [];

  const can = (permission: CmsPermissionCode) => hasCmsPermission(actor, permission);
  const when = <T>(permission: CmsPermissionCode, query: () => Promise<T[]>) => can(permission) ? query() : Promise.resolve([] as T[]);

  const [pageRows, postRows, offeringRows, equipmentRows, categoryRows, tagRows, supportRows, menuRows, redirectRows, mediaRows, partnerRows, testimonialRows] = await Promise.all([
    when("pages.view", () => getDb().select({ id: pages.id, label: pages.title, slug: pages.slug }).from(pages).where(and(isNull(pages.deletedAt), containsAny(keyword, pages.title, pages.slug))).orderBy(desc(pages.updatedAt)).limit(resultsPerKind)),
    when("posts.view", () => getDb().select({ id: posts.id, label: posts.title, slug: posts.slug, type: posts.type }).from(posts).where(and(isNull(posts.deletedAt), containsAny(keyword, posts.title, posts.slug))).orderBy(desc(posts.updatedAt)).limit(resultsPerKind)),
    when("offerings.view", () => getDb().select({ id: offerings.id, label: offerings.title, slug: offerings.slug, type: offerings.type }).from(offerings).where(and(isNull(offerings.deletedAt), containsAny(keyword, offerings.title, offerings.slug))).orderBy(desc(offerings.updatedAt)).limit(resultsPerKind)),
    when("equipment.view", () => getDb().select({ id: salesEquipment.id, label: salesEquipment.name, slug: salesEquipment.slug }).from(salesEquipment).where(and(isNull(salesEquipment.deletedAt), containsAny(keyword, salesEquipment.name, salesEquipment.slug, salesEquipment.modelCode))).orderBy(desc(salesEquipment.updatedAt)).limit(resultsPerKind)),
    when("taxonomy.view", () => getDb().select({ id: categories.id, label: categories.name, slug: categories.slug }).from(categories).where(containsAny(keyword, categories.name, categories.slug)).orderBy(desc(categories.updatedAt)).limit(resultsPerKind)),
    when("taxonomy.view", () => getDb().select({ id: tags.id, label: tags.name, slug: tags.slug }).from(tags).where(containsAny(keyword, tags.name, tags.slug)).orderBy(desc(tags.updatedAt)).limit(resultsPerKind)),
    when("support_downloads.view", () => getDb().select({ id: supportDownloads.id, label: supportDownloads.title, slug: supportDownloads.meta }).from(supportDownloads).where(and(isNull(supportDownloads.deletedAt), containsAny(keyword, supportDownloads.title, supportDownloads.meta))).orderBy(desc(supportDownloads.updatedAt)).limit(resultsPerKind)),
    when("navigation.view", () => getDb().select({ id: menuItems.id, label: menuItems.label, slug: menuItems.url }).from(menuItems).where(containsAny(keyword, menuItems.label, menuItems.url)).orderBy(desc(menuItems.updatedAt)).limit(resultsPerKind)),
    when("redirects.view", () => getDb().select({ id: redirects.id, label: redirects.sourcePath, slug: redirects.destinationPath }).from(redirects).where(containsAny(keyword, redirects.sourcePath, redirects.destinationPath)).orderBy(desc(redirects.updatedAt)).limit(resultsPerKind)),
    when("media.view", () => getDb().select({ id: mediaAssets.id, label: mediaAssets.originalName, slug: mediaAssets.storageKey }).from(mediaAssets).where(and(isNull(mediaAssets.deletedAt), containsAny(keyword, mediaAssets.originalName, mediaAssets.storageKey, mediaAssets.altText))).orderBy(desc(mediaAssets.updatedAt)).limit(resultsPerKind)),
    when("supporting.view", () => getDb().select({ id: partners.id, label: partners.name, slug: partners.websiteUrl }).from(partners).where(and(isNull(partners.deletedAt), containsAny(keyword, partners.name, partners.websiteUrl))).orderBy(desc(partners.updatedAt)).limit(resultsPerKind)),
    when("supporting.view", () => getDb().select({ id: testimonials.id, label: testimonials.authorName, slug: testimonials.company }).from(testimonials).where(and(isNull(testimonials.deletedAt), containsAny(keyword, testimonials.authorName, testimonials.company))).orderBy(desc(testimonials.updatedAt)).limit(resultsPerKind)),
  ]);

  const items: GlobalSearchResult[] = [
    ...pageRows.map((item) => ({ ...item, type: "Trang website", href: `/admin/pages/${item.id}` })),
    ...postRows.map((item) => ({ id: item.id, label: item.label, slug: item.slug, type: item.type === "guide" ? "Hướng dẫn sử dụng" : "Bài viết & Tin tức", href: item.type === "guide" ? `/admin/guides/${item.id}` : `/admin/news/${item.id}` })),
    ...offeringRows.map((item) => ({ id: item.id, label: item.label, slug: item.slug, type: item.type === "software" ? "Sản phẩm" : item.type === "solution" ? "Giải pháp" : "Dịch vụ", href: item.type === "software" ? `/admin/products/${item.id}` : item.type === "solution" ? `/admin/solutions/${item.id}` : `/admin/services/${item.id}` })),
    ...equipmentRows.map((item) => ({ ...item, type: "Thiết bị", href: `/admin/equipment/${item.id}` })),
    ...categoryRows.map((item) => ({ ...item, type: "Chuyên mục", href: "/admin/taxonomy" })),
    ...tagRows.map((item) => ({ ...item, type: "Thẻ", href: "/admin/taxonomy" })),
    ...supportRows.map((item) => ({ id: item.id, label: item.label, slug: item.slug ?? "tài-nguyên", type: "Tệp cài đặt", href: `/admin/resources/${item.id}` })),
    ...menuRows.map((item) => ({ ...item, type: "Menu & Điều hướng", href: "/admin/menu" })),
    ...redirectRows.map((item) => ({ ...item, type: "Chuyển hướng URL", href: "/admin/redirects" })),
    ...mediaRows.map((item) => ({ ...item, type: "Thư viện media", href: "/admin/media" })),
    ...partnerRows.map((item) => ({ id: item.id, label: item.label, slug: item.slug ?? "đối-tác", type: "Đối tác & Đánh giá", href: "/admin/partners" })),
    ...testimonialRows.map((item) => ({ id: item.id, label: item.label, slug: item.slug ?? "đánh-giá", type: "Đối tác & Đánh giá", href: "/admin/partners" })),
  ];

  const matchingRoutes = cmsRoutes
    .filter((route) => !route.permission || can(route.permission))
    .filter((item) => foldVietnamese(item.label).includes(foldVietnamese(keyword)) || item.slug.toLocaleLowerCase("vi").includes(keyword))
    .map(({ href, id, label, slug, type }) => ({ href, id, label, slug, type }));

  return [...items, ...matchingRoutes].sort((left, right) => rank(left, keyword) - rank(right, keyword) || left.label.localeCompare(right.label, "vi")).slice(0, Math.min(Math.max(limit, 1), 24));
}
