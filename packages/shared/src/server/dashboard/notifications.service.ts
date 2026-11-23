import { and, count, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, contactLeads, offerings, pages, posts, salesEquipment } from "@iorder/shared/db/schema";
import { hasCmsPermission, type CmsActor, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";
import { getBackupStatus } from "@iorder/shared/server/backup/backup-status";
import { getPublishingConfig } from "@iorder/shared/server/settings/publishing.service";

export type AdminNotification = { id: string; label: string; detail: string; href: string };

/** Liên hệ mới quá ngưỡng này mà chưa ai xử lý thì tách thành thông báo riêng. */
export const leadOverdueHours = 24;

/**
 * Lead mới tách làm hai dòng không trùng nhau: quá hạn (cần gọi ngay) và còn lại (mới đến).
 * `total` là mọi lead đang ở trạng thái "new", đã gồm `overdue`.
 */
export function leadNotifications(total: number, overdue: number): AdminNotification[] {
  const fresh = Math.max(0, total - overdue);
  return [
    ...(overdue > 0 ? [{ id: "leads-overdue", label: `Liên hệ chờ quá ${leadOverdueHours} giờ`, detail: `${overdue} liên hệ chưa được xử lý sau hơn ${leadOverdueHours} giờ.`, href: "/admin/leads?status=new" }] : []),
    ...(fresh > 0 ? [{ id: "leads-new", label: "Khách hàng tiềm năng mới", detail: `${fresh} liên hệ chưa xử lý.`, href: "/admin/leads?status=new" }] : []),
  ];
}

/**
 * Một tài khoản bị nhập sai mật khẩu từ ngần này lần trong cửa sổ bên dưới thì báo cho người xem nhật ký.
 * Bằng hạn mức theo tên đăng nhập của `login-throttle.ts` (5 lần/15 phút): đã đủ để bị khóa tạm,
 * nhưng đếm trong 24 giờ để người vận hành sáng hôm sau vẫn thấy. Chỉ tính tài khoản có thật
 * (đăng nhập sai tên đăng nhập không ghi nhật ký, xem `recordFailedLogin`).
 */
export const loginFailureThreshold = 5;
export const loginFailureWindowHours = 24;

export function loginFailureNotifications(accounts: number): AdminNotification[] {
  return accounts > 0
    ? [{ id: "login-failures", label: "Đăng nhập sai nhiều lần", detail: `${accounts} tài khoản bị nhập sai mật khẩu từ ${loginFailureThreshold} lần trong ${loginFailureWindowHours} giờ qua.`, href: "/admin/audit-log?verb=login_failed" }]
    : [];
}

// localhost, 127.x, ::1 và đuôi .local/.test/.localhost: máy phát triển, không phải website thật.
function isLocalHost(siteUrl: string) {
  try {
    const host = new URL(siteUrl).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return host === "localhost" || host === "::1" || /^127\./.test(host) || /\.(local|test|localhost)$/.test(host);
  } catch {
    return false;
  }
}

/**
 * Chỉ báo cấu hình làm website không xuất bản đúng. Các mục "chưa đạt" khác của Kiểm tra trước xuất bản
 * (thiếu nội dung, ảnh chưa có alt…) là việc dọn dần, không đưa lên chuông để chuông không đỏ mãi.
 * Tắt lập chỉ mục chỉ báo khi tên miền là tên miền thật; website đang dựng trên localhost tắt là chủ ý.
 */
export function siteConfigNotifications(config: { siteUrl: string | null; allowSearchIndexing: boolean } | null): AdminNotification[] {
  if (!config) return [];
  if (!config.siteUrl) return [{ id: "site-url", label: "Chưa có tên miền website", detail: "Sitemap và canonical chưa xuất bản được.", href: "/admin/seo" }];
  if (!config.allowSearchIndexing && !isLocalHost(config.siteUrl)) return [{ id: "site-indexing", label: "Đang chặn công cụ tìm kiếm", detail: "Đã có tên miền nhưng chưa cho phép lập chỉ mục.", href: "/admin/seo" }];
  return [];
}

const offeringTargets = {
  software: { label: "Sản phẩm", href: "/admin/products?type=software" },
  solution: { label: "Giải pháp", href: "/admin/products?type=solution" },
} as const;

/**
 * Việc cần xử lý cho chuông thông báo của CMS: lead mới và lead quá hạn, nội dung chờ duyệt,
 * sao lưu lỗi/quá hạn, cấu hình tên miền/lập chỉ mục và tài khoản bị đăng nhập sai nhiều lần.
 * Chạy ở mỗi lần điều hướng CMS nên chỉ gồm vài truy vấn đếm, và chỉ đếm module
 * người xem có quyền (lead cần `leads.view`, chờ duyệt cần `<module>.publish`, sao lưu cần `system.view`, cấu hình cần `settings.view`,
 * đăng nhập sai cần `audit.view`).
 */
export async function getAdminNotifications(actor: CmsActor): Promise<AdminNotification[]> {
  const can = (permission: CmsPermissionCode) => hasCmsPermission(actor, permission);
  const when = <T>(permission: CmsPermissionCode, query: () => Promise<T>, fallback: T) => can(permission) ? query() : Promise.resolve(fallback);
  const reviewCount = (table: typeof pages | typeof salesEquipment) => getDb().select({ total: count() }).from(table).where(and(eq(table.status, "review"), isNull(table.deletedAt))).then(([row]) => row?.total ?? 0);

  const overdueBefore = new Date(Date.now() - leadOverdueHours * 60 * 60 * 1000);
  const failuresSince = new Date(Date.now() - loginFailureWindowHours * 60 * 60 * 1000);
  const [newLeads, overdueLeads, pageReviews, postReviews, offeringReviews, equipmentReviews, backup, siteConfig, loginFailureAccounts] = await Promise.all([
    when("leads.view", () => getDb().select({ total: count() }).from(contactLeads).where(eq(contactLeads.status, "new")).then(([row]) => row?.total ?? 0), 0),
    when("leads.view", () => getDb().select({ total: count() }).from(contactLeads).where(and(eq(contactLeads.status, "new"), lt(contactLeads.createdAt, overdueBefore))).then(([row]) => row?.total ?? 0), 0),
    when("pages.publish", () => reviewCount(pages), 0),
    when("posts.publish", () => getDb().select({ isGuide: sql<boolean>`${posts.type} = 'guide'`, total: count() }).from(posts).where(and(eq(posts.status, "review"), isNull(posts.deletedAt))).groupBy(sql`${posts.type} = 'guide'`), []),
    when("offerings.publish", () => getDb().select({ type: offerings.type, total: count() }).from(offerings).where(and(eq(offerings.status, "review"), isNull(offerings.deletedAt))).groupBy(offerings.type), []),
    when("equipment.publish", () => reviewCount(salesEquipment), 0),
    when("system.view", () => getBackupStatus().then((status) => status.state), "ok" as const),
    when("settings.view", () => getPublishingConfig(), null),
    when("audit.view", () => getDb().select({ userId: auditLogs.userId }).from(auditLogs)
      .where(and(eq(auditLogs.action, "user.login_failed"), gte(auditLogs.createdAt, failuresSince), isNotNull(auditLogs.userId)))
      .groupBy(auditLogs.userId)
      .having(sql`count(*) >= ${loginFailureThreshold}`)
      .then((rows) => rows.length), 0),
  ]);

  const review = (id: string, label: string, total: number, href: string): AdminNotification[] => total > 0 ? [{ id, label: `${label} chờ duyệt`, detail: `${total} mục đang chờ xuất bản.`, href }] : [];
  return [
    // "never" chỉ hiện ở Tổng quan: máy dev chưa sao lưu không nên réo chuông mãi.
    ...(backup === "failed" ? [{ id: "backup-failed", label: "Sao lưu bị lỗi", detail: "Lần sao lưu gần nhất không thành công.", href: "/admin/backup" }] : []),
    ...(backup === "stale" ? [{ id: "backup-stale", label: "Sao lưu quá hạn", detail: "Hơn 36 giờ chưa có bản sao lưu mới.", href: "/admin/backup" }] : []),
    ...siteConfigNotifications(siteConfig),
    ...loginFailureNotifications(loginFailureAccounts),
    ...leadNotifications(newLeads, overdueLeads),
    ...review("review-pages", "Trang tĩnh", pageReviews, "/admin/pages?status=review"),
    ...postReviews.flatMap((row) => row.isGuide
      ? review("review-guides", "Hướng dẫn", row.total, "/admin/guides?status=review")
      : review("review-posts", "Bài viết", row.total, "/admin/news?status=review")),
    ...offeringReviews.flatMap((row) => row.type in offeringTargets
      ? review(`review-${row.type}`, offeringTargets[row.type as keyof typeof offeringTargets].label, row.total, `${offeringTargets[row.type as keyof typeof offeringTargets].href}&status=review`)
      : []),
    ...review("review-equipment", "Thiết bị", equipmentReviews, "/admin/equipment?status=review"),
  ];
}
