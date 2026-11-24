import { index, pgTable, primaryKey, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { adminNotificationStateEnum } from "./enums";
import { users } from "./identity";

/**
 * Thông báo trên chuông CMS không được lưu: chúng tính lại từ dữ liệu thật (liên hệ chưa xử lý, nội dung chờ duyệt, cảnh báo hệ thống).
 * Bảng này chỉ nhớ mỗi người đã đọc hay đã xóa thông báo nào. `notification_key` là mã thông báo (ví dụ lead-<id>); `fingerprint` là dấu hiệu
 * nội dung lúc đó (liên hệ đã quá hạn chưa, bài đã sửa lúc nào, số việc còn lại): thông báo đổi dấu hiệu thì coi là mới, hiện lại chưa đọc.
 * Dòng cũ hơn 30 ngày được dọn mỗi khi người dùng đọc/xóa thông báo.
 */
export const adminNotificationStates = pgTable(
  "admin_notification_states",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    notificationKey: varchar("notification_key", { length: 160 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 160 }).notNull(),
    state: adminNotificationStateEnum("state").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.notificationKey] }),
    index("admin_notification_states_updated_at_index").on(table.updatedAt),
  ],
);
