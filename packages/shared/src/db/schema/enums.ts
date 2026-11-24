import { pgEnum } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "review", "scheduled", "published", "archived"]);
export const postTypeEnum = pgEnum("post_type", ["news", "promotion", "case_study", "announcement", "guide"]);
export const offeringTypeEnum = pgEnum("offering_type", ["software", "solution"]);
// Tình trạng bán của thiết bị: hiện trên website và khai trong dữ liệu cấu trúc (schema.org ItemAvailability).
export const equipmentAvailabilityEnum = pgEnum("equipment_availability", ["in_stock", "limited", "pre_order", "out_of_stock", "discontinued"]);
export const partnerKindEnum = pgEnum("partner_kind", ["partner", "customer"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "closed"]);
// Trạng thái thông báo CMS của từng người: đã đọc (vẫn hiện, mờ đi) hoặc đã xóa (ẩn cho tới khi thông báo đó có thay đổi mới).
export const adminNotificationStateEnum = pgEnum("admin_notification_state", ["read", "dismissed"]);
