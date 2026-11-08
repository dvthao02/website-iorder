import { and, count, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { contactLeads, offerings, pages, posts, salesEquipment } from "@iorder/core/db/schema";
import { hasCmsPermission, type CmsActor, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { getBackupStatus } from "@iorder/core/server/backup/backup-status";

export type AdminNotification = { id: string; label: string; detail: string; href: string };

const offeringTargets = {
  software: { label: "Sản phẩm", href: "/admin/products?type=software" },
  solution: { label: "Giải pháp", href: "/admin/products?type=solution" },
  service: { label: "Dịch vụ", href: "/admin/products?type=service" },
} as const;

/**
 * Việc cần xử lý cho chuông thông báo của CMS: lead mới, nội dung chờ duyệt và sao lưu lỗi/quá hạn.
 * Chạy ở mỗi lần điều hướng CMS nên chỉ gồm vài truy vấn đếm, và chỉ đếm module
 * người xem có quyền (lead cần `leads.view`, chờ duyệt cần `<module>.publish`, sao lưu cần `settings.view`).
 */
export async function getAdminNotifications(actor: CmsActor): Promise<AdminNotification[]> {
  const can = (permission: CmsPermissionCode) => hasCmsPermission(actor, permission);
  const when = <T>(permission: CmsPermissionCode, query: () => Promise<T>, fallback: T) => can(permission) ? query() : Promise.resolve(fallback);
  const reviewCount = (table: typeof pages | typeof salesEquipment) => getDb().select({ total: count() }).from(table).where(and(eq(table.status, "review"), isNull(table.deletedAt))).then(([row]) => row?.total ?? 0);

  const [newLeads, pageReviews, postReviews, offeringReviews, equipmentReviews, backup] = await Promise.all([
    when("leads.view", () => getDb().select({ total: count() }).from(contactLeads).where(eq(contactLeads.status, "new")).then(([row]) => row?.total ?? 0), 0),
    when("pages.publish", () => reviewCount(pages), 0),
    when("posts.publish", () => getDb().select({ isGuide: sql<boolean>`${posts.type} = 'guide'`, total: count() }).from(posts).where(and(eq(posts.status, "review"), isNull(posts.deletedAt))).groupBy(sql`${posts.type} = 'guide'`), []),
    when("offerings.publish", () => getDb().select({ type: offerings.type, total: count() }).from(offerings).where(and(eq(offerings.status, "review"), isNull(offerings.deletedAt))).groupBy(offerings.type), []),
    when("equipment.publish", () => reviewCount(salesEquipment), 0),
    when("settings.view", () => getBackupStatus().then((status) => status.state), "ok" as const),
  ]);

  const review = (id: string, label: string, total: number, href: string): AdminNotification[] => total > 0 ? [{ id, label: `${label} chờ duyệt`, detail: `${total} mục đang chờ xuất bản.`, href }] : [];
  return [
    // "never" chỉ hiện ở Tổng quan: máy dev chưa sao lưu không nên réo chuông mãi.
    ...(backup === "failed" ? [{ id: "backup-failed", label: "Sao lưu bị lỗi", detail: "Lần sao lưu gần nhất không thành công.", href: "/admin/backup" }] : []),
    ...(backup === "stale" ? [{ id: "backup-stale", label: "Sao lưu quá hạn", detail: "Hơn 36 giờ chưa có bản sao lưu mới.", href: "/admin/backup" }] : []),
    ...(newLeads > 0 ? [{ id: "leads-new", label: "Khách hàng tiềm năng mới", detail: `${newLeads} liên hệ chưa xử lý.`, href: "/admin/leads?status=new" }] : []),
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
