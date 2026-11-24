import type { AdminNotification } from "./notifications.contract";

// Đã đọc / đã xóa thông báo của từng người (bảng admin_notification_states). Phần thuần, không đụng DB, để kiểm thử được.

/** Trạng thái đã nhớ của một thông báo, kèm dấu hiệu nội dung lúc người dùng đọc hoặc xóa. */
export type NotificationState = { fingerprint: string; state: "read" | "dismissed" };

/** Thời gian giữ trạng thái của thông báo đã hết hiệu lực (liên hệ đã xử lý, bài đã xuất bản…) trước khi dọn. */
export const notificationStateRetentionDays = 30;

/**
 * Áp trạng thái của người xem lên danh sách thông báo hiện tính được: thông báo đã xóa (cùng dấu hiệu) bị ẩn, đã đọc thì đánh dấu `read`,
 * còn lại chưa đọc. Dấu hiệu khác với lúc đọc/xóa nghĩa là thông báo có thay đổi mới (liên hệ vừa quá hạn, bài vừa sửa lại, số việc tăng):
 * hiện lại như thông báo mới chưa đọc.
 */
export function applyNotificationStates(items: readonly AdminNotification[], states: ReadonlyMap<string, NotificationState>): AdminNotification[] {
  const result: AdminNotification[] = [];
  for (const item of items) {
    const saved = states.get(item.id);
    const current = saved && saved.fingerprint === (item.fingerprint ?? "") ? saved.state : null;
    if (current === "dismissed") continue;
    result.push({ ...item, read: current === "read" });
  }
  return result;
}
