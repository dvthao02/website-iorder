import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { contentStatusEnum, offeringTypeEnum } from "./enums";
import { users } from "./identity";
import { mediaAssets } from "./media";
import { timestamps } from "./shared";

export const offerings = pgTable(
  "offerings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    type: offeringTypeEnum("type").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    summary: text("summary"),
    content: jsonb("content").$type<unknown>().notNull(),
    icon: varchar("icon", { length: 120 }),
    status: contentStatusEnum("status").default("draft").notNull(),
    draftVersion: integer("draft_version").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    seoTitle: varchar("seo_title", { length: 70 }),
    seoDescription: varchar("seo_description", { length: 180 }),
    canonicalUrl: text("canonical_url"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("offerings_active_type_slug_unique").on(table.type, table.slug).where(sql`${table.deletedAt} is null`),
    index("offerings_type_status_sort_index").on(table.type, table.status, table.sortOrder),
  ],
);

export const offeringRevisions = pgTable(
  "offering_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offeringId: uuid("offering_id").notNull().references(() => offerings.id, { onDelete: "cascade" }),
    editorId: uuid("editor_id").references(() => users.id, { onDelete: "set null" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
    changeNote: varchar("change_note", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("offering_revisions_version_unique").on(table.offeringId, table.versionNumber)],
);

export const equipmentGroups = pgTable(
  "equipment_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    description: text("description"),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("equipment_groups_active_slug_unique").on(table.slug).where(sql`${table.deletedAt} is null`),
    index("equipment_groups_enabled_sort_index").on(table.isEnabled, table.sortOrder),
  ],
);

export const salesEquipment = pgTable(
  "sales_equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => equipmentGroups.id),
    name: varchar("name", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    modelCode: varchar("model_code", { length: 80 }),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    priceVnd: bigint("price_vnd", { mode: "number" }).notNull(),
    warrantyMonths: integer("warranty_months").default(12).notNull(),
    summary: text("summary"),
    specificationGroups: jsonb("specification_groups").$type<unknown[]>().default([]).notNull(),
    status: contentStatusEnum("status").default("draft").notNull(),
    draftVersion: integer("draft_version").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    seoTitle: varchar("seo_title", { length: 70 }),
    seoDescription: varchar("seo_description", { length: 180 }),
    canonicalUrl: text("canonical_url"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("sales_equipment_active_slug_unique").on(table.slug).where(sql`${table.deletedAt} is null`),
    index("sales_equipment_group_status_sort_index").on(table.groupId, table.status, table.sortOrder),
  ],
);

export const salesEquipmentRevisions = pgTable(
  "sales_equipment_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    salesEquipmentId: uuid("sales_equipment_id").notNull().references(() => salesEquipment.id, { onDelete: "cascade" }),
    editorId: uuid("editor_id").references(() => users.id, { onDelete: "set null" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
    changeNote: varchar("change_note", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("sales_equipment_revisions_version_unique").on(table.salesEquipmentId, table.versionNumber)],
);
