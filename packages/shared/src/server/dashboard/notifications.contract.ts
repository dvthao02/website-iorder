import { z } from "zod";

// Một việc cần xử lý trên chuông thông báo của CMS. Trình duyệt tự làm mới danh sách định kỳ nên kiểm lại dữ liệu nhận về theo schema này.
export const adminNotificationSchema = z.object({
  id: z.string().min(1).max(160),
  label: z.string().min(1).max(200),
  detail: z.string().max(400),
  href: z.string().min(1).max(300),
  /** Số việc dòng này đại diện (dòng "Còn N liên hệ khác"); mặc định 1. Tổng các dòng là số hiện trên chuông. */
  count: z.number().int().min(1).max(100_000).optional(),
  /** "urgent": việc quá hạn hoặc lỗi cần xử lý ngay (hiện chấm đỏ). */
  tone: z.enum(["urgent", "normal"]).optional(),
  /**
   * Dấu hiệu nội dung của thông báo lúc này (liên hệ đã quá hạn chưa, bài sửa lúc nào, số việc còn lại…). Người dùng đã đọc hay xóa thông báo
   * nào thì được nhớ kèm dấu hiệu đó; thông báo đổi dấu hiệu là thông báo mới, hiện lại chưa đọc.
   */
  fingerprint: z.string().max(160).optional(),
  /** Người xem đã đọc thông báo này chưa. Không có khi không biết người xem. */
  read: z.boolean().optional(),
});
export const adminNotificationsSchema = z.array(adminNotificationSchema).max(50);
export type AdminNotification = z.infer<typeof adminNotificationSchema>;

/** Liên hệ mới quá ngưỡng này mà chưa ai xử lý thì tách thành thông báo riêng và được đánh dấu "Chờ …" trong danh sách. */
export const leadOverdueHours = 24;

/** Số việc cần xử lý: mỗi dòng tính 1, dòng gộp ("Còn N liên hệ khác") tính N. */
export function notificationTotal(items: readonly AdminNotification[]) {
  return items.reduce((total, item) => total + (item.count ?? 1), 0);
}

/** Số việc chưa đọc: con số hiện trên chuông. Thông báo đã đọc vẫn nằm trong danh sách nhưng không tính. */
export function unreadNotificationCount(items: readonly AdminNotification[]) {
  return notificationTotal(items.filter((item) => !item.read));
}

// Thao tác của người dùng lên thông báo của chính họ: đọc / bỏ đọc / xóa từng thông báo (theo mã), đọc hết hoặc xóa hết thông báo đang hiện.
export const adminNotificationActionSchema = z.union([
  z.object({ action: z.enum(["read", "unread", "dismiss"]), ids: z.array(z.string().min(1).max(160)).min(1).max(100) }).strict(),
  z.object({ action: z.enum(["read_all", "dismiss_all"]) }).strict(),
]);
export type AdminNotificationAction = z.infer<typeof adminNotificationActionSchema>;
export const adminNotificationsResponseSchema = z.object({ notifications: adminNotificationsSchema });
