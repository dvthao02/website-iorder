import { sql } from "drizzle-orm";
import { AnyPgColumn, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { currentRequestContext } from "../../server/shared/request-context";
import { mediaAssets } from "./media";
import { users } from "./identity";
import { timestamps } from "./shared";

export const menus = pgTable(
  "menus",
  { id: uuid("id").defaultRandom().primaryKey(), name: varchar("name", { length: 120 }).notNull(), location: varchar("location", { length: 80 }).notNull(), version: integer("version").default(0).notNull(), ...timestamps() },
  (table) => [uniqueIndex("menus_location_unique").on(table.location)],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuId: uuid("menu_id").notNull().references(() => menus.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => menuItems.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 180 }).notNull(),
    url: text("url").notNull(),
    linkType: varchar("link_type", { length: 32 }).default("custom").notNull(),
    contentId: uuid("content_id"),
    target: varchar("target", { length: 20 }).default("_self").notNull(),
    icon: varchar("icon", { length: 120 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    ...timestamps(),
  },
  (table) => [
    index("menu_items_parent_id_index").on(table.parentId),
    uniqueIndex("menu_items_position_unique").on(table.menuId, table.parentId, table.sortOrder),
    index("menu_items_menu_enabled_index").on(table.menuId, table.isEnabled),
    index("menu_items_content_reference_index").on(table.linkType, table.contentId),
  ],
);

export const menuRevisions = pgTable(
  "menu_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuId: uuid("menu_id").notNull().references(() => menus.id, { onDelete: "cascade" }),
    editorId: uuid("editor_id").references(() => users.id, { onDelete: "set null" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
    changeNote: varchar("change_note", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("menu_revisions_version_unique").on(table.menuId, table.versionNumber)],
);

export const siteProfile = pgTable(
  "site_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileKey: varchar("profile_key", { length: 40 }).default("default").notNull(),
    companyName: varchar("company_name", { length: 220 }).notNull(),
    legalName: varchar("legal_name", { length: 220 }),
    hotline: varchar("hotline", { length: 60 }),
    supportEmail: varchar("support_email", { length: 320 }),
    salesEmail: varchar("sales_email", { length: 320 }),
    address: text("address"),
    workingHours: varchar("working_hours", { length: 255 }),
    logoMediaId: uuid("logo_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    version: integer("version").default(0).notNull(), ...timestamps(),
  },
  (table) => [uniqueIndex("site_profile_key_unique").on(table.profileKey)],
);

export const siteSettings = pgTable(
  "site_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 160 }).notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    description: varchar("description", { length: 500 }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    version: integer("version").default(0).notNull(), ...timestamps(),
  },
  (table) => [uniqueIndex("site_settings_key_unique").on(table.key)],
);

// Khóa API và thông tin kết nối do Super Admin nhập ở CMS (Cài đặt → Kết nối & khóa API). `payload` là bản MÃ HÓA AES-256-GCM (v1.nonce.tag.ciphertext;
// khóa chủ SECRETS_MASTER_KEY nằm ở môi trường, không nằm trong database); `hint` là gợi ý không bí mật hiển thị lại (email tài khoản dịch vụ, bốn ký tự cuối).
// Không có đường nào đọc giá trị rõ ra ngoài tiến trình Backend.
export const secureSettings = pgTable(
  "secure_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 80 }).notNull(),
    payload: text("payload").notNull(),
    hint: varchar("hint", { length: 200 }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    version: integer("version").default(0).notNull(), ...timestamps(),
  },
  (table) => [uniqueIndex("secure_settings_key_unique").on(table.key)],
);

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourcePath: varchar("source_path", { length: 500 }).notNull(),
    destinationPath: varchar("destination_path", { length: 1000 }).notNull(),
    statusCode: integer("status_code").default(301).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").default(0).notNull(), ...timestamps(),
  },
  (table) => [uniqueIndex("redirects_source_path_unique").on(table.sourcePath).where(sql`${table.deletedAt} is null`), index("redirects_enabled_index").on(table.isEnabled), index("redirects_deleted_at_index").on(table.deletedAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: uuid("entity_id"),
    beforeData: jsonb("before_data").$type<unknown>(),
    afterData: jsonb("after_data").$type<unknown>(),
    ipHash: varchar("ip_hash", { length: 128 }),
    // Lấy từ ngữ cảnh request khi insert (xem request-context.ts); script/seed để trống.
    ipAddress: varchar("ip_address", { length: 64 }).$defaultFn(() => currentRequestContext()?.ipAddress ?? sql`null`),
    userAgent: varchar("user_agent", { length: 500 }).$defaultFn(() => currentRequestContext()?.userAgent ?? sql`null`),
    requestId: varchar("request_id", { length: 128 }).$defaultFn(() => currentRequestContext()?.requestId ?? sql`null`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_logs_entity_index").on(table.entityType, table.entityId), index("audit_logs_user_created_at_index").on(table.userId, table.createdAt), index("audit_logs_ip_address_index").on(table.ipAddress),
    // Danh sách và tìm kiếm Nhật ký hoạt động sắp theo thời gian mới nhất (createdAt, id giảm dần; phải là DESC NULLS FIRST, đúng thứ tự mặc định của ORDER BY ... DESC, thì PostgreSQL mới dùng — bản DESC NULLS LAST bị bỏ qua) và lọc theo khoảng ngày; không có chỉ mục này thì mỗi lần mở trang phải sắp xếp cả bảng (bảng này lớn dần theo từng thao tác quản trị).
    index("audit_logs_created_at_index").on(table.createdAt.desc().nullsFirst(), table.id.desc().nullsFirst())],
);

// Nhật ký lỗi của Backend (xem server/error-log): mỗi lỗi nặng (logger.error) được gom theo dấu vân tay, nên một lỗi lặp lại cả nghìn lần
// vẫn chỉ là một dòng với số lần xảy ra. Bảng không tham chiếu khóa ngoại để việc ghi lỗi không bao giờ vướng ràng buộc khi hệ thống đang hỏng.
export const errorLogs = pgTable(
  "error_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    message: text("message").notNull(),
    errorName: varchar("error_name", { length: 160 }),
    errorMessage: text("error_message"),
    method: varchar("method", { length: 12 }),
    path: varchar("path", { length: 400 }),
    // Lần xảy ra gần nhất (các cột dưới đây bị ghi đè mỗi lần lỗi lặp lại).
    requestId: varchar("request_id", { length: 128 }),
    details: jsonb("details").$type<unknown>().notNull(),
    occurrences: integer("occurrences").default(1).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("error_logs_fingerprint_unique").on(table.fingerprint),
    // Trang Nhật ký lỗi sắp theo lần xảy ra gần nhất; thứ tự phải là DESC NULLS FIRST thì PostgreSQL mới dùng chỉ mục (xem audit_logs_created_at_index).
    index("error_logs_last_seen_at_index").on(table.lastSeenAt.desc().nullsFirst(), table.id.desc().nullsFirst())],
);

// Bản dịch nội dung công khai theo từng câu tiếng Việt (khóa = mã băm của câu gốc, xem server/translations/translatable.ts), không theo vị trí:
// đổi thứ tự khối hay một câu xuất hiện ở nhiều trang vẫn dùng đúng một bản dịch. Chữ cố định của giao diện website dùng khóa là tên ("ui.header.openMenu"). source_text giữ câu gốc lúc dịch để đối chiếu và để biết bản dịch nào
// không còn câu gốc tương ứng trong nội dung.
export const contentTranslations = pgTable(
  "content_translations",
  {
    locale: varchar("locale", { length: 12 }).notNull(),
    sourceKey: varchar("source_key", { length: 128 }).notNull(),
    sourceText: text("source_text").notNull(),
    value: text("value").notNull(),
    ...timestamps(),
  },
  (table) => [primaryKey({ columns: [table.locale, table.sourceKey] })],
);
