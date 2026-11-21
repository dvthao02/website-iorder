import { sql } from "drizzle-orm";
import { AnyPgColumn, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { contentStatusEnum, postTypeEnum } from "./enums";
import { users } from "./identity";
import { mediaAssets } from "./media";
import { timestamps } from "./shared";

// Hồ sơ tác giả công khai (trang /tac-gia/<slug>, Person trong dữ liệu cấu trúc). Khác `users`: tác giả không cần có tài khoản CMS (chuyên gia, khách mời).
export const postAuthors = pgTable(
  "post_authors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 140 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    jobTitle: varchar("job_title", { length: 120 }),
    bio: text("bio"),
    avatarMediaId: uuid("avatar_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    profileUrl: text("profile_url"),
    // Bật thì trang riêng của tác giả hiện trên website (cần có bài đã xuất bản); tắt thì bài vẫn ghi tên nhưng không có liên kết tới trang.
    isEnabled: boolean("is_enabled").default(false).notNull(),
    version: integer("version").default(0).notNull(),
    ...timestamps(),
  },
  (table) => [index("post_authors_avatar_media_id_index").on(table.avatarMediaId), uniqueIndex("post_authors_slug_unique").on(table.slug)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    // Tác giả hiển thị công khai (chọn từ post_authors). Có thì ưu tiên hơn author_name/title/url (tác giả khách nhập tay, không có trang riêng).
    authorProfileId: uuid("author_profile_id").references((): AnyPgColumn => postAuthors.id, { onDelete: "set null" }),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    type: postTypeEnum("type").notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    excerpt: text("excerpt"),
    content: jsonb("content").$type<unknown>().notNull(),
    contentHtml: text("content_html"),
    status: contentStatusEnum("status").default("draft").notNull(),
    draftVersion: integer("draft_version").default(0).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    seoTitle: varchar("seo_title", { length: 70 }),
    seoDescription: varchar("seo_description", { length: 180 }),
    canonicalUrl: text("canonical_url"),
    seo: jsonb("seo").$type<unknown>().default({}).notNull(),
    promotionStartAt: timestamp("promotion_start_at", { withTimezone: true }),
    promotionEndAt: timestamp("promotion_end_at", { withTimezone: true }),
    ctaLabel: varchar("cta_label", { length: 80 }),
    ctaUrl: text("cta_url"),
    badgeText: varchar("badge_text", { length: 60 }),
    // Tác giả hiển thị công khai (Person trong dữ liệu cấu trúc); khác author_id là tài khoản CMS đã tạo bài. Để trống: website ghi tổ chức là tác giả như trước.
    authorName: varchar("author_name", { length: 120 }),
    authorTitle: varchar("author_title", { length: 120 }),
    authorUrl: text("author_url"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("posts_cover_media_id_index").on(table.coverMediaId),
    index("posts_author_id_index").on(table.authorId),
    index("posts_author_profile_id_index").on(table.authorProfileId),
    uniqueIndex("posts_active_slug_unique").on(table.slug).where(sql`${table.deletedAt} is null`),
    index("posts_status_published_at_index").on(table.status, table.publishedAt),
    index("posts_type_status_index").on(table.type, table.status),
  ],
);

export const postRevisions = pgTable(
  "post_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    editorId: uuid("editor_id").references(() => users.id, { onDelete: "set null" }),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
    changeNote: varchar("change_note", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("post_revisions_version_unique").on(table.postId, table.versionNumber)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    version: integer("version").default(0).notNull(), ...timestamps(),
  },
  (table) => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    index("categories_parent_sort_index").on(table.parentId, table.sortOrder),
  ],
);

export const tags = pgTable(
  "tags",
  { id: uuid("id").defaultRandom().primaryKey(), name: varchar("name", { length: 120 }).notNull(), slug: varchar("slug", { length: 140 }).notNull(), version: integer("version").default(0).notNull(), ...timestamps() },
  (table) => [uniqueIndex("tags_slug_unique").on(table.slug)],
);

export const postCategories = pgTable(
  "post_categories",
  { postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }), categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }) },
  (table) => [
    primaryKey({ columns: [table.postId, table.categoryId] }),
    index("post_categories_category_post_index").on(table.categoryId, table.postId),
  ],
);

export const postTags = pgTable(
  "post_tags",
  { postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }), tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "restrict" }) },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("post_tags_tag_post_index").on(table.tagId, table.postId),
  ],
);
