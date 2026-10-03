import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { contentStatusEnum } from "./enums";
import { users } from "./identity";
import { timestamps } from "./shared";

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    template: varchar("template", { length: 80 }).default("default").notNull(),
    status: contentStatusEnum("status").default("draft").notNull(),
    draftVersion: integer("draft_version").default(0).notNull(),
    seoTitle: varchar("seo_title", { length: 70 }),
    seoDescription: varchar("seo_description", { length: 180 }),
    canonicalUrl: text("canonical_url"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("pages_active_slug_unique").on(table.slug).where(sql`${table.deletedAt} is null`),
    index("pages_status_published_at_index").on(table.status, table.publishedAt),
  ],
);

export const pageBlocks = pgTable(
  "page_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 80 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    data: jsonb("data").$type<unknown>().notNull(),
    appearance: jsonb("appearance").$type<unknown>(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("page_blocks_position_unique").on(table.pageId, table.sortOrder),
    index("page_blocks_page_enabled_index").on(table.pageId, table.isEnabled),
  ],
);

export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    editorId: uuid("editor_id").references(() => users.id, { onDelete: "set null" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
    changeNote: varchar("change_note", { length: 500 }),
    isPublished: boolean("is_published").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("page_revisions_version_unique").on(table.pageId, table.versionNumber)],
);
