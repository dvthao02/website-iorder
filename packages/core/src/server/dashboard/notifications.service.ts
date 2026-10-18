import { and, count, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { contactLeads, offerings, pages, posts, salesEquipment } from "@iorder/core/db/schema";
import { hasCmsPermission, type CmsActor, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";

export type AdminNotification = { id: string; label: string; detail: string; href: string };

const offeringTargets = {
  software: { label: "Sản phẩm", href: "/admin/san-pham" },
  solution: { label: "Giải pháp", href: "/admin/giai-phap" },
  service: { label: "Dịch vụ", href: "/admin/dich-vu" },
} as const;

/**
 * Việc cần xử lý cho chuông thông báo của CMS: lead mới và nội dung chờ duyệt.
 * Chạy ở mỗi lần điều hướng CMS nên chỉ gồm vài truy vấn đếm, và chỉ đếm module
 * người xem có quyền (lead cần `leads.view`, chờ duyệt cần `<module>.publish`).
 */
export async function getAdminNotifications(actor: CmsActor): Promise<AdminNotification[]> {
  const can = (permission: CmsPermissionCode) => hasCmsPermission(actor, permission);
  const when = <T>(permission: CmsPermissionCode, query: () => Promise<T>, fallback: T) => can(permission) ? query() : Promise.resolve(fallback);
  const reviewCount = (table: typeof pages | typeof salesEquipment) => getDb().select({ total: count() }).from(table).where(and(eq(table.status, "review"), isNull(table.deletedAt))).then(([row]) => row?.total ?? 0);

  const [newLeads, pageReviews, postReviews, offeringReviews, equipmentReviews] = await Promise.all([
    when("leads.view", () => getDb().select({ total: count() }).from(contactLeads).where(eq(contactLeads.status, "new")).then(([row]) => row?.total ?? 0), 0),
    when("pages.publish", () => reviewCount(pages), 0),
    when("posts.publish", () => getDb().select({ isGuide: sql<boolean>`${posts.type} = 'guide'`, total: count() }).from(posts).where(and(eq(posts.status, "review"), isNull(posts.deletedAt))).groupBy(sql`${posts.type} = 'guide'`), []),
    when("offerings.publish", () => getDb().select({ type: offerings.type, total: count() }).from(offerings).where(and(eq(offerings.status, "review"), isNull(offerings.deletedAt))).groupBy(offerings.type), []),
    when("equipment.publish", () => reviewCount(salesEquipment), 0),
  ]);

  const review = (id: string, label: string, total: number, href: string): AdminNotification[] => total > 0 ? [{ id, label: `${label} chờ duyệt`, detail: `${total} mục đang chờ xuất bản.`, href }] : [];
  return [
    ...(newLeads > 0 ? [{ id: "leads-new", label: "Khách hàng tiềm năng mới", detail: `${newLeads} liên hệ chưa xử lý.`, href: "/admin/khach-hang-tiem-nang?status=new" }] : []),
    ...review("review-pages", "Trang website", pageReviews, "/admin/pages?status=review"),
    ...postReviews.flatMap((row) => row.isGuide
      ? review("review-guides", "Hướng dẫn", row.total, "/admin/tai-nguyen?tab=guides&status=review")
      : review("review-posts", "Bài viết", row.total, "/admin/tin-tuc?status=review")),
    ...offeringReviews.flatMap((row) => row.type in offeringTargets
      ? review(`review-${row.type}`, offeringTargets[row.type as keyof typeof offeringTargets].label, row.total, `${offeringTargets[row.type as keyof typeof offeringTargets].href}?status=review`)
      : []),
    ...review("review-equipment", "Thiết bị", equipmentReviews, "/admin/thiet-bi?status=review"),
  ];
}
