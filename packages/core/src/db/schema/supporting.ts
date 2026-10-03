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
    ...timestamps(),
  },
  (table) => [uniqueIndex("partners_name_unique").on(table.name), index("partners_enabled_sort_index").on(table.isEnabled, table.sortOrder)],
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
    ...timestamps(),
  },
  (table) => [index("testimonials_enabled_sort_index").on(table.isEnabled, table.sortOrder)],
);

export const supportDownloads = pgTable(
  "support_downloads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileMediaId: uuid("file_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    icon: varchar("icon", { length: 60 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    meta: varchar("meta", { length: 160 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    draftVersion: integer("draft_version").default(0).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [index("support_downloads_enabled_sort_index").on(table.isEnabled, table.sortOrder)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    handledBy: uuid("handled_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [index("contact_leads_status_created_index").on(table.status, table.createdAt), index("contact_leads_created_index").on(table.createdAt)],
);
