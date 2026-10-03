import { AnyPgColumn, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

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
    target: varchar("target", { length: 20 }).default("_self").notNull(),
    icon: varchar("icon", { length: 120 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("menu_items_position_unique").on(table.menuId, table.parentId, table.sortOrder),
    index("menu_items_menu_enabled_index").on(table.menuId, table.isEnabled),
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
    ...timestamps(),
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
    ...timestamps(),
  },
  (table) => [uniqueIndex("site_settings_key_unique").on(table.key)],
);

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourcePath: varchar("source_path", { length: 500 }).notNull(),
    destinationPath: varchar("destination_path", { length: 1000 }).notNull(),
    statusCode: integer("status_code").default(301).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("redirects_source_path_unique").on(table.sourcePath), index("redirects_enabled_index").on(table.isEnabled)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_logs_entity_index").on(table.entityType, table.entityId), index("audit_logs_user_created_at_index").on(table.userId, table.createdAt)],
);
