import { and, asc, count, desc, eq, gte, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { getDb } from "@iorder/shared/db/client";
import { shownFullName, visibleActor } from "../users/hidden-users";
import { auditLogs, contactLeads, offerings, pages, posts, salesEquipment, users } from "@iorder/shared/db/schema";
import { hasCmsPermission, type CmsActor, type CmsPermissionCode } from "@iorder/shared/server/auth/permissions";
import { getBackupStatus } from "@iorder/shared/server/backup/backup-status";
import { parseLeadContext } from "@iorder/shared/server/leads/leads.contract";
import { formatPhoneDisplay } from "@iorder/shared/server/leads/leads.phone";
import { getPublishingConfig } from "@iorder/shared/server/settings/publishing.service";
import { formatTimeAgo, formatWaitingTime } from "@iorder/shared/server/shared/relative-time";
import { applyNotificationStates } from "./notification-state";
import { forgetNotificationStates, listNotificationStates, purgeOldNotificationStates, saveNotificationStates } from "./notification-state.repository";
import { leadOverdueHours, type AdminNotification, type AdminNotificationAction } from "./notifications.contract";

export { leadOverdueHours };
export type { AdminNotification };

/** Số liên hệ chưa xử lý được nêu riêng từng người trên chuông (còn lại gộp một dòng "Còn N liên hệ khác"). */
export const leadNotificationLimit = 5;
/** Số mục chờ duyệt được nêu riêng từng mục cho mỗi loại nội dung. */
export const reviewNotificationLimit = 3;

/**
 * Một liên hệ chưa xử lý được nêu riêng trên chuông. `mine`: được giao đúng cho người đang xem. `assigneeName`: đã giao cho người khác nhưng quá hạn
 * (chỉ người quản lý, có quyền xóa liên hệ, thấy để nhắc việc).
 */
export type LeadNotificationRow = { id: string; name: string; phone: string; need: string | null; deviceName: string | null; createdAt: Date; mine: boolean; assigneeName: string | null };

/**
 * Liên hệ "Mới" mà người xem cần lo: do họ phụ trách hoặc chưa giao cho ai. `total` và `overdue` đếm cả nhóm; `items` là các liên hệ được nêu riêng
 * (quá hạn cũ nhất trước, rồi liên hệ mới nhất), đã giới hạn `leadNotificationLimit`.
 */
export type LeadBacklog = { total: number; overdue: number; items: LeadNotificationRow[] };
const emptyLeadBacklog: LeadBacklog = { total: 0, overdue: 0, items: [] };

/**
 * Mỗi liên hệ một thông báo nói rõ việc cần làm: gọi lại ai, họ hỏi gì (thiết bị nào hay nhu cầu gì), số điện thoại, đã chờ bao lâu, có được giao cho mình không.
 * Bấm vào mở thẳng liên hệ đó. Liên hệ quá hạn có dấu hiệu khẩn. Phần còn lại gộp một dòng dẫn tới danh sách xếp cũ nhất trước.
 */
export function leadNotifications(backlog: LeadBacklog, now: Date = new Date()): AdminNotification[] {
  const overdueMs = leadOverdueHours * 60 * 60 * 1000;
  const items = backlog.items.map((row): AdminNotification => {
    const overdue = now.getTime() - row.createdAt.getTime() >= overdueMs;
    const what = row.deviceName ? `hỏi mua ${row.deviceName}` : row.need;
    return {
      id: `lead-${row.id}`,
      label: `${row.assigneeName ? `${row.assigneeName} chưa gọi lại ${row.name}` : `Gọi lại ${row.name}`}${what ? ` — ${what}` : ""}`,
      detail: [row.mine ? "Giao cho bạn" : null, formatPhoneDisplay(row.phone).text, overdue ? `chờ ${formatWaitingTime(row.createdAt, now)} chưa xử lý` : formatTimeAgo(row.createdAt, now)].filter(Boolean).join(" · "),
      href: `/admin/leads?open=${row.id}`,
      tone: overdue ? "urgent" : "normal",
      // Quá hạn hoặc vừa được giao cho mình là diễn biến mới: thông báo đã đọc/xóa trước đó hiện lại.
      fingerprint: `${overdue ? "overdue" : "new"}${row.mine ? ":mine" : ""}${row.assigneeName ? ":other" : ""}`,
    };
  });
  const rest = backlog.total - backlog.items.length;
  if (rest <= 0) return items;
  const overdueRest = Math.max(0, backlog.overdue - items.filter((item) => item.tone === "urgent").length);
  return [...items, {
    id: "leads-more", label: `Còn ${rest} liên hệ khác chưa xử lý`,
    detail: overdueRest > 0 ? `Trong đó ${overdueRest} liên hệ chờ quá ${leadOverdueHours} giờ. Mở danh sách, cũ nhất xếp trước.` : "Mở danh sách liên hệ chưa xử lý.",
    href: "/admin/leads?status=new&sort=createdAt&dir=asc", count: rest, tone: overdueRest > 0 ? "urgent" : "normal", fingerprint: String(rest),
  }];
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
    ? [{ id: "login-failures", label: "Đăng nhập sai nhiều lần", detail: `${accounts} tài khoản bị nhập sai mật khẩu từ ${loginFailureThreshold} lần trong ${loginFailureWindowHours} giờ qua.`, href: "/admin/audit-log?verb=login_failed", tone: "urgent", fingerprint: String(accounts) }]
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

export type ReviewKind = "pages" | "posts" | "guides" | "software" | "solution" | "equipment";
/** Một mục nội dung đang chờ duyệt xuất bản. */
export type ReviewRow = { id: string; title: string; updatedAt: Date };

// Trang sửa của từng loại (theo mã) và danh sách chờ duyệt tương ứng.
const reviewTargets: Record<ReviewKind, { noun: string; edit: (id: string) => string; list: string }> = {
  pages: { noun: "trang", edit: (id) => `/admin/pages/${id}`, list: "/admin/pages?status=review" },
  posts: { noun: "bài viết", edit: (id) => `/admin/news/${id}`, list: "/admin/news?status=review" },
  guides: { noun: "hướng dẫn", edit: (id) => `/admin/guides/${id}`, list: "/admin/guides?status=review" },
  software: { noun: "sản phẩm", edit: (id) => `/admin/products/${id}`, list: "/admin/products?type=software&status=review" },
  solution: { noun: "giải pháp", edit: (id) => `/admin/solutions/${id}`, list: "/admin/products?type=solution&status=review" },
  equipment: { noun: "thiết bị", edit: (id) => `/admin/equipment/${id}`, list: "/admin/equipment?status=review" },
};

/**
 * Mỗi mục chờ duyệt một thông báo ("Duyệt bài viết: <tiêu đề>", lần sửa cuối, mở thẳng trang sửa); mục chờ lâu nhất xếp trước.
 * Quá `reviewNotificationLimit` mục thì phần còn lại gộp một dòng dẫn tới danh sách chờ duyệt của loại đó. `total` là tổng số mục chờ duyệt.
 */
export function reviewNotifications(kind: ReviewKind, rows: readonly ReviewRow[], total: number, now: Date = new Date()): AdminNotification[] {
  const target = reviewTargets[kind];
  const shown = rows.slice(0, reviewNotificationLimit);
  const items = shown.map((row): AdminNotification => ({
    id: `review-${kind}-${row.id}`, label: `Duyệt ${target.noun}: ${row.title}`,
    detail: `Chờ xuất bản · sửa lần cuối ${formatTimeAgo(row.updatedAt, now)}`, href: target.edit(row.id),
    // Sửa thêm lần nữa trong lúc chờ duyệt là thay đổi mới: hiện lại chưa đọc.
    fingerprint: row.updatedAt.toISOString(),
  }));
  const rest = total - shown.length;
  return rest > 0 ? [...items, { id: `review-${kind}-more`, label: `Còn ${rest} ${target.noun} khác chờ duyệt`, detail: "Mở danh sách chờ duyệt.", href: target.list, count: rest, fingerprint: String(rest) }] : items;
}

/** Người xem thông báo: quyền và (nếu biết) tài khoản, để chỉ nêu liên hệ do họ phụ trách hoặc chưa giao cho ai. */
export type NotificationActor = CmsActor & { userId?: string };

/**
 * Thông báo cho chuông CMS của người xem, đã áp trạng thái họ đã đọc hoặc đã xóa (thông báo đã xóa bị ẩn, đã đọc thì `read: true`).
 * Không biết tài khoản người xem thì mọi thông báo đều chưa đọc.
 */
export async function getAdminNotifications(actor: NotificationActor): Promise<AdminNotification[]> {
  const items = await collectAdminNotifications(actor);
  if (!actor.userId || items.length === 0) return items.map((item) => ({ ...item, read: false }));
  return applyNotificationStates(items, await listNotificationStates(actor.userId));
}

/**
 * Đọc, bỏ đọc hoặc xóa thông báo của chính người xem rồi trả danh sách mới. Thông báo là kết quả tính lại từ dữ liệu thật nên "xóa" chỉ là ẩn
 * với riêng người này cho tới khi thông báo đó có thay đổi mới (dấu hiệu đổi); mã không còn tồn tại thì bỏ qua.
 */
export async function changeNotificationStates(actor: NotificationActor & { userId: string }, action: AdminNotificationAction): Promise<AdminNotification[]> {
  const all = await collectAdminNotifications(actor);
  const states = await listNotificationStates(actor.userId);
  const visible = applyNotificationStates(all, states);
  const wanted = new Set("ids" in action ? action.ids : visible.map((item) => item.id));
  const targets = all.filter((item) => wanted.has(item.id));
  if (action.action === "unread") await forgetNotificationStates(actor.userId, targets.map((item) => item.id));
  else {
    const state = action.action === "dismiss" || action.action === "dismiss_all" ? "dismissed" : "read";
    await saveNotificationStates(actor.userId, targets.map((item) => ({ key: item.id, fingerprint: item.fingerprint ?? "", state })));
  }
  await purgeOldNotificationStates(actor.userId);
  return applyNotificationStates(all, await listNotificationStates(actor.userId));
}

/**
 * Việc cần xử lý cho chuông thông báo của CMS, mỗi việc một dòng nói rõ làm gì: gọi lại từng khách chưa xử lý, duyệt từng nội dung chờ duyệt,
 * sao lưu lỗi/quá hạn, cấu hình tên miền/lập chỉ mục và tài khoản bị đăng nhập sai nhiều lần.
 * Chạy ở mỗi lần điều hướng CMS và mỗi phút, nên mỗi nhóm chỉ một vài truy vấn nhỏ, và chỉ lấy module
 * người xem có quyền (liên hệ cần `leads.view`, chờ duyệt cần `<module>.publish`, sao lưu cần `system.view`, cấu hình cần `settings.view`,
 * đăng nhập sai cần `audit.view`).
 */
export async function collectAdminNotifications(actor: NotificationActor): Promise<AdminNotification[]> {
  const can = (permission: CmsPermissionCode) => hasCmsPermission(actor, permission);
  const when = <T>(permission: CmsPermissionCode, query: () => Promise<T>, fallback: T) => can(permission) ? query() : Promise.resolve(fallback);
  const now = new Date();
  const overdueBefore = new Date(now.getTime() - leadOverdueHours * 60 * 60 * 1000);
  const failuresSince = new Date(now.getTime() - loginFailureWindowHours * 60 * 60 * 1000);
  // Tổng số mục trước khi giới hạn (đếm bằng hàm cửa sổ): một truy vấn cho cả danh sách lẫn tổng.
  const totalOver = sql<number>`(count(*) over ())::int`;
  const noReviews: { rows: ReviewRow[]; total: number } = { rows: [], total: 0 };
  const reviews = (rows: Array<ReviewRow & { total: number }>) => ({ rows, total: rows[0]?.total ?? 0 });
  // Cột id/tiêu đề/ngày sửa của mỗi bảng khác tên nhau nên nhận theo từng bảng; kiểu cột chung chung nên ép về dạng một dòng chờ duyệt.
  const pendingReviews = (table: PgTable, columns: { id: AnyPgColumn; title: AnyPgColumn; updatedAt: AnyPgColumn }, condition: SQL | undefined) => getDb()
    .select({ id: columns.id, title: columns.title, updatedAt: columns.updatedAt, total: totalOver }).from(table).where(condition)
    .orderBy(asc(columns.updatedAt)).limit(reviewNotificationLimit).then((rows) => reviews(rows as Array<ReviewRow & { total: number }>));

  // Liên hệ do mình phụ trách hoặc chưa giao cho ai (không biết tài khoản thì chỉ liên hệ chưa giao).
  // Do mình phụ trách hoặc chưa giao cho ai; người quản lý (quyền xóa liên hệ) còn thấy liên hệ đã giao cho người khác mà quá hạn, để nhắc việc.
  const manager = can("leads.delete");
  const visibleToActor = actor.userId
    ? or(isNull(contactLeads.assignedTo), eq(contactLeads.assignedTo, actor.userId), manager ? and(isNotNull(contactLeads.assignedTo), lt(contactLeads.createdAt, overdueBefore)) : undefined)
    : isNull(contactLeads.assignedTo);
  const pendingLeads: SQL | undefined = and(eq(contactLeads.status, "new"), isNull(contactLeads.deletedAt), visibleToActor);
  const leadRows = (condition: SQL | undefined, order: SQL) => getDb().select({ id: contactLeads.id, name: contactLeads.name, phone: contactLeads.phone, need: contactLeads.need, context: contactLeads.context, createdAt: contactLeads.createdAt, assignedTo: contactLeads.assignedTo, assigneeName: shownFullName<string | null>() })
    .from(contactLeads).leftJoin(users, eq(users.id, contactLeads.assignedTo)).where(and(pendingLeads, condition)).orderBy(order).limit(leadNotificationLimit);

  const [leadBacklog, pageReviews, postReviews, guideReviews, softwareReviews, solutionReviews, equipmentReviews, backup, siteConfig, loginFailureAccounts] = await Promise.all([
    when("leads.view", async (): Promise<LeadBacklog> => {
      const [[totals], overdueRows, freshRows] = await Promise.all([
        getDb().select({ total: count(), overdue: sql<number>`(count(*) filter (where ${contactLeads.createdAt} < ${overdueBefore.toISOString()}::timestamptz))::int` }).from(contactLeads).where(pendingLeads),
        leadRows(lt(contactLeads.createdAt, overdueBefore), asc(contactLeads.createdAt)),
        leadRows(gte(contactLeads.createdAt, overdueBefore), desc(contactLeads.createdAt)),
      ]);
      const items = [...overdueRows, ...freshRows].slice(0, leadNotificationLimit).map((row): LeadNotificationRow => ({
        id: row.id, name: row.name, phone: row.phone, need: row.need, deviceName: parseLeadContext(row.context)?.name ?? null, createdAt: row.createdAt,
        mine: Boolean(actor.userId && row.assignedTo === actor.userId),
        assigneeName: row.assignedTo && row.assignedTo !== actor.userId ? row.assigneeName : null,
      }));
      return { total: totals?.total ?? 0, overdue: totals?.overdue ?? 0, items };
    }, emptyLeadBacklog),
    // Mỗi loại nội dung chờ duyệt một truy vấn nhỏ: mục chờ lâu nhất trước (giới hạn `reviewNotificationLimit`), kèm tổng số.
    when("pages.publish", () => pendingReviews(pages, { id: pages.id, title: pages.title, updatedAt: pages.updatedAt }, and(eq(pages.status, "review"), isNull(pages.deletedAt))), noReviews),
    when("posts.publish", () => pendingReviews(posts, { id: posts.id, title: posts.title, updatedAt: posts.updatedAt }, and(eq(posts.status, "review"), isNull(posts.deletedAt), ne(posts.type, "guide"))), noReviews),
    when("posts.publish", () => pendingReviews(posts, { id: posts.id, title: posts.title, updatedAt: posts.updatedAt }, and(eq(posts.status, "review"), isNull(posts.deletedAt), eq(posts.type, "guide"))), noReviews),
    when("offerings.publish", () => pendingReviews(offerings, { id: offerings.id, title: offerings.title, updatedAt: offerings.updatedAt }, and(eq(offerings.status, "review"), isNull(offerings.deletedAt), eq(offerings.type, "software"))), noReviews),
    when("offerings.publish", () => pendingReviews(offerings, { id: offerings.id, title: offerings.title, updatedAt: offerings.updatedAt }, and(eq(offerings.status, "review"), isNull(offerings.deletedAt), eq(offerings.type, "solution"))), noReviews),
    when("equipment.publish", () => pendingReviews(salesEquipment, { id: salesEquipment.id, title: salesEquipment.name, updatedAt: salesEquipment.updatedAt }, and(eq(salesEquipment.status, "review"), isNull(salesEquipment.deletedAt))), noReviews),
    when("system.view", () => getBackupStatus().then((status) => status.state), "ok" as const),
    when("settings.view", () => getPublishingConfig(), null),
    when("audit.view", () => getDb().select({ userId: auditLogs.userId }).from(auditLogs)
      .where(and(eq(auditLogs.action, "user.login_failed"), gte(auditLogs.createdAt, failuresSince), isNotNull(auditLogs.userId), visibleActor(auditLogs.userId)))
      .groupBy(auditLogs.userId)
      .having(sql`count(*) >= ${loginFailureThreshold}`)
      .then((rows) => rows.length), 0),
  ]);

  return [
    // "never" chỉ hiện ở Tổng quan: máy dev chưa sao lưu không nên réo chuông mãi.
    ...(backup === "failed" ? [{ id: "backup-failed", label: "Sao lưu bị lỗi", detail: "Lần sao lưu gần nhất không thành công.", href: "/admin/backup", tone: "urgent" as const }] : []),
    ...(backup === "stale" ? [{ id: "backup-stale", label: "Sao lưu quá hạn", detail: "Hơn 36 giờ chưa có bản sao lưu mới.", href: "/admin/backup" }] : []),
    ...siteConfigNotifications(siteConfig),
    ...loginFailureNotifications(loginFailureAccounts),
    ...leadNotifications(leadBacklog, now),
    ...reviewNotifications("pages", pageReviews.rows, pageReviews.total, now),
    ...reviewNotifications("posts", postReviews.rows, postReviews.total, now),
    ...reviewNotifications("guides", guideReviews.rows, guideReviews.total, now),
    ...reviewNotifications("software", softwareReviews.rows, softwareReviews.total, now),
    ...reviewNotifications("solution", solutionReviews.rows, solutionReviews.total, now),
    ...reviewNotifications("equipment", equipmentReviews.rows, equipmentReviews.total, now),
  ];
}
