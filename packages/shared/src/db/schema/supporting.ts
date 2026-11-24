import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { leadStatusEnum, partnerKindEnum } from "./enums";
import { users } from "./identity";
import { mediaAssets } from "./media";
import { timestamps } from "./shared";

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    logoMediaId: uuid("logo_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    kind: partnerKindEnum("kind").default("partner").notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    websiteUrl: text("website_url"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").default(0).notNull(), ...timestamps(),
  },
  (table) => [index("partners_logo_media_id_index").on(table.logoMediaId), uniqueIndex("partners_name_unique").on(table.name).where(sql`${table.deletedAt} is null`), index("partners_enabled_sort_index").on(table.isEnabled, table.sortOrder), index("partners_deleted_at_index").on(table.deletedAt)],
);

export const testimonials = pgTable(
  "testimonials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    avatarMediaId: uuid("avatar_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 180 }).notNull(),
    authorRole: varchar("author_role", { length: 180 }),
    company: varchar("company", { length: 180 }),
    quote: text("quote").notNull(),
    rating: integer("rating"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").default(0).notNull(), ...timestamps(),
  },
  (table) => [index("testimonials_avatar_media_id_index").on(table.avatarMediaId), index("testimonials_enabled_sort_index").on(table.isEnabled, table.sortOrder), index("testimonials_deleted_at_index").on(table.deletedAt)],
);

export const supportDownloads = pgTable(
  "support_downloads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileMediaId: uuid("file_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    // Link tải về ngoài (https) thay cho tệp trong thư viện; một mục chỉ dùng một nguồn (tệp hoặc link).
    externalUrl: varchar("external_url", { length: 1000 }),
    // Nhóm hiển thị trên trang Hỗ trợ cài đặt (ví dụ "Driver trên Windows"); trống = nhóm "Khác".
    groupName: varchar("group_name", { length: 120 }),
    icon: varchar("icon", { length: 60 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    meta: varchar("meta", { length: 160 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    draftVersion: integer("draft_version").default(0).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [index("support_downloads_file_media_id_index").on(table.fileMediaId), index("support_downloads_enabled_sort_index").on(table.isEnabled, table.sortOrder), index("support_downloads_deleted_at_index").on(table.deletedAt)],
);

export const supportDownloadRevisions = pgTable(
  "support_download_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supportDownloadId: uuid("support_download_id").notNull().references(() => supportDownloads.id, { onDelete: "cascade" }),
    editorId: uuid("editor_id").references(() => users.id, { onDelete: "set null" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
    changeNote: varchar("change_note", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("support_download_revisions_version_unique").on(table.supportDownloadId, table.versionNumber)],
);

export const contactLeads = pgTable(
  "contact_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    email: varchar("email", { length: 320 }),
    businessModel: varchar("business_model", { length: 120 }),
    branches: varchar("branches", { length: 60 }),
    need: varchar("need", { length: 200 }),
    message: text("message"),
    status: leadStatusEnum("status").default("new").notNull(),
    ipHash: varchar("ip_hash", { length: 128 }),
    // Số điện thoại chỉ gồm chữ số (đầu 84 đổi thành 0): giới hạn số lần gửi theo từng số và nhận ra liên hệ trùng, dù khách gõ dấu cách, +84 hay dấu chấm.
    phoneDigits: varchar("phone_digits", { length: 20 }),
    // Thiết bị khách hỏi mua, chụp tại thời điểm gửi (leadContextSchema): tên, mã, giá và tình trạng hàng lúc đó, không đổi khi thiết bị sửa sau này. Null = liên hệ chung.
    context: jsonb("context").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    handledBy: uuid("handled_by").references(() => users.id, { onDelete: "set null" }),
    // Ghi chú nội bộ của nhân viên (kết quả cuộc gọi, hẹn lại...). Khách không bao giờ thấy; chỉ CMS đọc và ghi.
    internalNote: text("internal_note"),
    // Người phụ trách xử lý liên hệ (nhân viên CMS có quyền sửa khách hàng tiềm năng) và thời điểm giao.
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    // Xóa (liên hệ rác, liên hệ đã gộp vào liên hệ khác): ẩn khỏi CMS và xóa thông tin cá nhân của khách (leads.repository.ts › scrubbedLead), nhưng dòng vẫn còn để giới hạn chống spam theo IP, số điện thoại (dạng chữ số) và thiết bị đếm đủ.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [index("contact_leads_handled_by_index").on(table.handledBy), index("contact_leads_assigned_to_index").on(table.assignedTo), index("contact_leads_deleted_by_index").on(table.deletedBy), index("contact_leads_status_created_index").on(table.status, table.createdAt), index("contact_leads_phone_created_index").on(table.phoneDigits, table.createdAt), index("contact_leads_created_index").on(table.createdAt)],
);
