import "dotenv/config";

import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { and, eq, isNull } from "drizzle-orm";
import postgres from "postgres";

import { getDb } from "../packages/core/src/db/client";
import {
  auditLogs,
  categories,
  equipmentGroups,
  mediaAssets,
  offeringRevisions,
  offerings,
  partners,
  postCategories,
  postRevisions,
  postTags,
  posts,
  salesEquipment,
  salesEquipmentRevisions,
  supportDownloadRevisions,
  supportDownloads,
  tags,
  testimonials,
  users,
} from "../packages/core/src/db/schema";
import { equipmentInputSchema } from "../packages/core/src/server/equipment/equipment.contract";
import { ensureMediaBucket, hasStoredObject, putStoredObject } from "../packages/core/src/server/media/storage";
import { offeringContentSchema } from "../packages/core/src/server/offerings/offering-content.contract";
import { postContentDocumentSchema } from "../packages/core/src/server/posts/posts.contract";

const sourceDatabaseName = process.env.V1_IMPORT_DATABASE?.trim() || "iorder_v1_import_20260925";
const sourceMediaRoot = resolve(process.env.V1_MEDIA_ROOT?.trim() || "../iorderwebsite/iorder-website/storage/media");
const sourceLabel = "V1 local backup 2026-09-25";
const importPrefix = "imports/v1-local";

type SourceMedia = {
  id: string;
  storage_key: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
};

type SourceOffering = {
  id: string;
  cover_media_id: string | null;
  type: "software" | "solution" | "service" | "industry";
  title: string;
  slug: string;
  summary: string | null;
  content_json: unknown;
  icon: string | null;
  status: "draft" | "review" | "scheduled" | "published" | "archived";
  sort_order: number;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type SourcePost = {
  id: string;
  cover_media_id: string | null;
  type: "news" | "promotion" | "case_study" | "announcement" | "guide";
  title: string;
  slug: string;
  excerpt: string | null;
  content_json: unknown;
  content_html: string | null;
  status: "draft" | "review" | "scheduled" | "published" | "archived";
  view_count: number;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  promotion_start_at: Date | string | null;
  promotion_end_at: Date | string | null;
  cta_label: string | null;
  cta_url: string | null;
  badge_text: string | null;
  scheduled_at: Date | string | null;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  category_slugs: string[];
  tag_slugs: string[];
};

type SourceCategory = { name: string; slug: string; description: string | null; sort_order: number };
type SourceTag = { name: string; slug: string };

type SourceEquipment = {
  id: string;
  category: "pos" | "printer" | "scanner" | "cash_drawer";
  name: string;
  slug: string;
  model_code: string | null;
  cover_media_id: string | null;
  price_vnd: number;
  warranty_months: number;
  summary: string | null;
  specification_groups: unknown;
  status: "draft" | "review" | "scheduled" | "published" | "archived";
  sort_order: number;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type SourceTestimonial = {
  avatar_media_id: string | null;
  author_name: string;
  author_role: string | null;
  company: string | null;
  quote: string;
  rating: number | null;
  sort_order: number;
  is_enabled: boolean;
};

type SourcePartner = {
  logo_media_id: string | null;
  kind: "partner" | "customer";
  name: string;
  description: string | null;
  website_url: string | null;
  sort_order: number;
  is_enabled: boolean;
};

type SourceDownload = {
  id: string;
  file_media_id: string | null;
  icon: string;
  title: string;
  description: string | null;
  meta: string | null;
  sort_order: number;
  is_enabled: boolean;
};

type ImportSummary = Record<"media" | "offerings" | "posts" | "equipmentGroups" | "equipment" | "testimonials" | "partners" | "downloads", { created: number; skipped: number }> & { missingFiles: string[] };

function requiredTargetDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("Cần đặt DATABASE_URL trước khi import dữ liệu V1.");
  return value;
}

function sourceDatabaseUrl() {
  const configured = process.env.V1_SOURCE_DATABASE_URL?.trim();
  if (configured) return configured;

  const target = new URL(requiredTargetDatabaseUrl());
  target.pathname = `/${sourceDatabaseName}`;
  target.search = "";
  return target.toString();
}

function toDate(value: Date | string | null) {
  return value ? new Date(value) : null;
}

function contentStatus(value: SourceOffering["status"] | SourcePost["status"] | SourceEquipment["status"]) {
  return value === "scheduled" ? "draft" : value;
}

function sourceFilePath(storageKey: string) {
  const filePath = resolve(sourceMediaRoot, storageKey);
  const relativePath = relative(sourceMediaRoot, filePath);
  if (relativePath.startsWith("..") || relativePath === "") {
    throw new Error(`Khóa tệp V1 không hợp lệ: ${storageKey}`);
  }
  return filePath;
}

function importedStorageKey(sourceKey: string) {
  return `${importPrefix}/${sourceKey}`;
}

function sourceSnapshot(sourceId: string, values: Record<string, unknown>) {
  return { source: sourceLabel, sourceId, importedAt: new Date().toISOString(), ...values };
}

function postContent(content: unknown) {
  const raw = content as { body?: unknown; checklist?: unknown };
  if (typeof raw.body !== "string") {
    throw new Error("Bài viết V1 không có phần nội dung văn bản hợp lệ.");
  }

  const paragraphs = raw.body.split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);
  const checklist = Array.isArray(raw.checklist) ? raw.checklist.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  return postContentDocumentSchema.parse({
    version: 1,
    blocks: [
      ...paragraphs.map((text) => ({ type: "paragraph" as const, text })),
      ...(checklist.length ? [{ type: "checklist" as const, heading: "Câu hỏi kiểm tra", items: checklist }] : []),
    ],
  });
}

function equipmentSpecificationGroups(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Thông số thiết bị V1 không phải danh sách hợp lệ.");
  return value.map((group) => {
    if (!group || typeof group !== "object" || !("title" in group) || !("items" in group) || typeof group.title !== "string" || !Array.isArray(group.items)) {
      throw new Error("Nhóm thông số thiết bị V1 không hợp lệ.");
    }
    const sourceGroup = group as { title: string; items: unknown[] };
    return {
      title: sourceGroup.title,
      items: sourceGroup.items.map((item: unknown, index: number) => {
        if (item && typeof item === "object" && "label" in item && "value" in item && typeof item.label === "string" && typeof item.value === "string") {
          return { label: item.label, value: item.value };
        }
        if (typeof item !== "string" || !item.trim()) throw new Error("Một thông số thiết bị V1 không hợp lệ.");
        return { label: `Thông tin ${index + 1}`, value: item.trim() };
      }),
    };
  });
}

const equipmentGroupsByCategory = {
  pos: { name: "Thiết bị POS", slug: "thiet-bi-pos", description: "Máy POS và thiết bị bán hàng tại quầy.", sortOrder: 0 },
  printer: { name: "Máy in", slug: "may-in", description: "Máy in hóa đơn và phụ kiện in ấn.", sortOrder: 1 },
  scanner: { name: "Máy quét mã vạch", slug: "may-quet-ma-vach", description: "Thiết bị quét mã vạch cho bán lẻ và kho.", sortOrder: 2 },
  cash_drawer: { name: "Két đựng tiền", slug: "ket-dung-tien", description: "Két đựng tiền cho quầy thu ngân.", sortOrder: 3 },
} as const;

async function main() {
  const db = getDb();
  const source = postgres(sourceDatabaseUrl(), { prepare: false, connect_timeout: 15 });
  const summary: ImportSummary = {
    media: { created: 0, skipped: 0 },
    offerings: { created: 0, skipped: 0 },
    posts: { created: 0, skipped: 0 },
    equipmentGroups: { created: 0, skipped: 0 },
    equipment: { created: 0, skipped: 0 },
    testimonials: { created: 0, skipped: 0 },
    partners: { created: 0, skipped: 0 },
    downloads: { created: 0, skipped: 0 },
    missingFiles: [],
  };

  try {
    const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
    if (!username) throw new Error("Cần đặt INITIAL_ADMIN_USERNAME trước khi import dữ liệu V1.");
    const [author] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (!author) throw new Error("Không tìm thấy tài khoản quản trị V2 để ghi nhận audit import.");

    const [sourceMedia, sourceOfferings, sourcePosts, sourceCategories, sourceTags, sourceEquipment, sourceTestimonials, sourcePartners, sourceDownloads] = await Promise.all([
      source.unsafe("SELECT id::text, storage_key, original_name, mime_type, file_size::int, width, height, alt_text, caption FROM media_assets ORDER BY storage_key") as unknown as Promise<SourceMedia[]>,
      source.unsafe("SELECT id::text, cover_media_id::text, type, title, slug, summary, content_json, icon, status, sort_order, is_featured, seo_title, seo_description, canonical_url, published_at, created_at, updated_at FROM offerings WHERE deleted_at IS NULL AND type IN ('software', 'solution', 'service') ORDER BY type, sort_order") as unknown as Promise<SourceOffering[]>,
      source.unsafe("SELECT p.id::text, p.cover_media_id::text, p.type, p.title, p.slug, p.excerpt, p.content_json, p.content_html, p.status, p.view_count, p.seo_title, p.seo_description, p.canonical_url, p.promotion_start_at, p.promotion_end_at, p.cta_label, p.cta_url, p.badge_text, p.scheduled_at, p.published_at, p.created_at, p.updated_at, COALESCE(array_remove(array_agg(DISTINCT c.slug), NULL), '{}') AS category_slugs, COALESCE(array_remove(array_agg(DISTINCT t.slug), NULL), '{}') AS tag_slugs FROM posts p LEFT JOIN post_categories pc ON pc.post_id = p.id LEFT JOIN categories c ON c.id = pc.category_id LEFT JOIN post_tags pt ON pt.post_id = p.id LEFT JOIN tags t ON t.id = pt.tag_id WHERE p.deleted_at IS NULL GROUP BY p.id ORDER BY p.published_at DESC NULLS LAST") as unknown as Promise<SourcePost[]>,
      source.unsafe("SELECT name, slug, description, sort_order FROM categories ORDER BY sort_order, name") as unknown as Promise<SourceCategory[]>,
      source.unsafe("SELECT name, slug FROM tags ORDER BY name") as unknown as Promise<SourceTag[]>,
      source.unsafe("SELECT id::text, category, name, slug, model_code, cover_media_id::text, price_vnd::bigint::text::bigint AS price_vnd, warranty_months, summary, specification_groups, status, sort_order, is_featured, seo_title, seo_description, canonical_url, published_at, created_at, updated_at FROM sales_equipment WHERE deleted_at IS NULL ORDER BY category, sort_order") as unknown as Promise<SourceEquipment[]>,
      source.unsafe("SELECT avatar_media_id::text, author_name, author_role, company, quote, rating, sort_order, is_enabled FROM testimonials ORDER BY sort_order, author_name") as unknown as Promise<SourceTestimonial[]>,
      source.unsafe("SELECT logo_media_id::text, kind, name, description, website_url, sort_order, is_enabled FROM partners ORDER BY sort_order, name") as unknown as Promise<SourcePartner[]>,
      source.unsafe("SELECT id::text, file_media_id::text, icon, title, description, meta, sort_order, is_enabled FROM support_downloads ORDER BY sort_order, title") as unknown as Promise<SourceDownload[]>,
    ]);

    await ensureMediaBucket();
    const mediaIds = new Map<string, string>();
    for (const item of sourceMedia) {
      const storageKey = importedStorageKey(item.storage_key);
      const [existing] = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.storageKey, storageKey)).limit(1);
      const filePath = sourceFilePath(item.storage_key);

      try {
        if (!(await hasStoredObject(storageKey))) {
          await putStoredObject({ storageKey, body: await readFile(filePath), mimeType: item.mime_type });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "lỗi không xác định";
        summary.missingFiles.push(`${item.storage_key}: ${message}`);
        continue;
      }

      if (existing) {
        mediaIds.set(item.id, existing.id);
        summary.media.skipped += 1;
        continue;
      }

      const [created] = await db.insert(mediaAssets).values({
        uploadedBy: author.id,
        storageKey,
        originalName: item.original_name,
        mimeType: item.mime_type,
        fileSize: item.file_size,
        width: item.width,
        height: item.height,
        altText: item.alt_text,
        caption: item.caption,
      }).returning({ id: mediaAssets.id });
      if (!created) throw new Error(`Không thể tạo metadata cho tệp V1: ${item.storage_key}`);
      await db.insert(auditLogs).values({ userId: author.id, action: "media.import_v1_local", entityType: "media_asset", entityId: created.id, afterData: sourceSnapshot(item.id, { storageKey, originalName: item.original_name }) });
      mediaIds.set(item.id, created.id);
      summary.media.created += 1;
    }

    for (const item of sourceOfferings) {
      const [existing] = await db.select({ id: offerings.id }).from(offerings).where(and(eq(offerings.type, item.type), eq(offerings.slug, item.slug), isNull(offerings.deletedAt))).limit(1);
      if (existing) {
        summary.offerings.skipped += 1;
        continue;
      }
      const content = offeringContentSchema.parse(item.content_json);
      const values = {
        coverMediaId: item.cover_media_id ? mediaIds.get(item.cover_media_id) ?? null : null,
        type: item.type,
        title: item.title,
        slug: item.slug,
        summary: item.summary,
        content,
        icon: item.icon,
        status: contentStatus(item.status),
        draftVersion: 1,
        sortOrder: item.sort_order,
        isFeatured: item.is_featured,
        seoTitle: item.seo_title,
        seoDescription: item.seo_description,
        canonicalUrl: item.canonical_url,
        publishedAt: toDate(item.published_at),
        createdAt: toDate(item.created_at) ?? new Date(),
        updatedAt: toDate(item.updated_at) ?? new Date(),
      } as const;
      const [created] = await db.insert(offerings).values(values).returning({ id: offerings.id });
      if (!created) throw new Error(`Không thể tạo catalog V1: ${item.slug}`);
      const snapshot = sourceSnapshot(item.id, values);
      await db.insert(offeringRevisions).values({ offeringId: created.id, editorId: author.id, versionNumber: 1, snapshot, changeNote: "Import từ backup V1" });
      await db.insert(auditLogs).values({ userId: author.id, action: "offering.import_v1_local", entityType: "offering", entityId: created.id, afterData: snapshot });
      summary.offerings.created += 1;
    }

    const categoryIds = new Map<string, string>();
    for (const item of sourceCategories) {
      const [existing] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, item.slug)).limit(1);
      if (existing) {
        categoryIds.set(item.slug, existing.id);
        continue;
      }
      const [created] = await db.insert(categories).values({
        name: item.name,
        slug: item.slug,
        description: item.description,
        sortOrder: item.sort_order,
      }).returning({ id: categories.id });
      if (!created) throw new Error(`Không thể tạo chuyên mục V1: ${item.slug}`);
      categoryIds.set(item.slug, created.id);
      await db.insert(auditLogs).values({ userId: author.id, action: "category.import_v1_local", entityType: "category", entityId: created.id, afterData: sourceSnapshot(item.slug, item) });
    }

    const tagIds = new Map<string, string>();
    for (const item of sourceTags) {
      const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, item.slug)).limit(1);
      if (existing) {
        tagIds.set(item.slug, existing.id);
        continue;
      }
      const [created] = await db.insert(tags).values(item).returning({ id: tags.id });
      if (!created) throw new Error(`Không thể tạo thẻ V1: ${item.slug}`);
      tagIds.set(item.slug, created.id);
      await db.insert(auditLogs).values({ userId: author.id, action: "tag.import_v1_local", entityType: "tag", entityId: created.id, afterData: sourceSnapshot(item.slug, item) });
    }

    for (const item of sourcePosts) {
      const [existing] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.slug, item.slug), isNull(posts.deletedAt))).limit(1);
      if (existing) {
        summary.posts.skipped += 1;
        continue;
      }
      const values = {
        authorId: author.id,
        coverMediaId: item.cover_media_id ? mediaIds.get(item.cover_media_id) ?? null : null,
        type: item.type,
        title: item.title,
        slug: item.slug,
        excerpt: item.excerpt,
        content: postContent(item.content_json),
        contentHtml: item.content_html,
        status: contentStatus(item.status),
        draftVersion: 1,
        viewCount: item.view_count,
        seoTitle: item.seo_title,
        seoDescription: item.seo_description,
        canonicalUrl: item.canonical_url,
        promotionStartAt: toDate(item.promotion_start_at),
        promotionEndAt: toDate(item.promotion_end_at),
        ctaLabel: item.cta_label,
        ctaUrl: item.cta_url,
        badgeText: item.badge_text,
        scheduledAt: toDate(item.scheduled_at),
        publishedAt: toDate(item.published_at),
        createdAt: toDate(item.created_at) ?? new Date(),
        updatedAt: toDate(item.updated_at) ?? new Date(),
      } as const;
      const [created] = await db.insert(posts).values(values).returning({ id: posts.id });
      if (!created) throw new Error(`Không thể tạo bài viết V1: ${item.slug}`);
      const postCategoryValues = item.category_slugs.flatMap((slug) => categoryIds.has(slug) ? [{ postId: created.id, categoryId: categoryIds.get(slug)! }] : []);
      const postTagValues = item.tag_slugs.flatMap((slug) => tagIds.has(slug) ? [{ postId: created.id, tagId: tagIds.get(slug)! }] : []);
      if (postCategoryValues.length) await db.insert(postCategories).values(postCategoryValues).onConflictDoNothing();
      if (postTagValues.length) await db.insert(postTags).values(postTagValues).onConflictDoNothing();
      await db.insert(postRevisions).values({ postId: created.id, editorId: author.id, versionNumber: 1, snapshot: sourceSnapshot(item.id, values), changeNote: "Import từ backup V1" });
      await db.insert(auditLogs).values({ userId: author.id, action: "post.import_v1_local", entityType: "post", entityId: created.id, afterData: sourceSnapshot(item.id, values) });
      summary.posts.created += 1;
    }

    const equipmentGroupIds = new Map<string, string>();
    for (const item of sourceEquipment) {
      const groupInput = equipmentGroupsByCategory[item.category];
      let groupId = equipmentGroupIds.get(item.category);
      const [existingGroup] = groupId ? [] : await db.select({ id: equipmentGroups.id }).from(equipmentGroups).where(and(eq(equipmentGroups.slug, groupInput.slug), isNull(equipmentGroups.deletedAt))).limit(1);
      groupId ??= existingGroup?.id ?? (await db.insert(equipmentGroups).values({ ...groupInput, coverMediaId: null, isEnabled: true }).returning({ id: equipmentGroups.id }))[0]?.id;
      if (!groupId) throw new Error(`Không thể tạo nhóm thiết bị V1: ${item.category}`);
      if (!equipmentGroupIds.has(item.category) && existingGroup) summary.equipmentGroups.skipped += 1;
      else if (!equipmentGroupIds.has(item.category)) {
        summary.equipmentGroups.created += 1;
        await db.insert(auditLogs).values({ userId: author.id, action: "equipment_group.import_v1_local", entityType: "equipment_group", entityId: groupId, afterData: sourceSnapshot(item.category, groupInput) });
      }
      equipmentGroupIds.set(item.category, groupId);

      const [existing] = await db.select({ id: salesEquipment.id }).from(salesEquipment).where(and(eq(salesEquipment.slug, item.slug), isNull(salesEquipment.deletedAt))).limit(1);
      if (existing) {
        summary.equipment.skipped += 1;
        continue;
      }
      const values = equipmentInputSchema.parse({
        groupId,
        name: item.name,
        slug: item.slug,
        modelCode: item.model_code,
        coverMediaId: item.cover_media_id ? mediaIds.get(item.cover_media_id) ?? null : null,
        priceVnd: Number(item.price_vnd),
        warrantyMonths: item.warranty_months,
        summary: item.summary,
        specificationGroups: equipmentSpecificationGroups(item.specification_groups),
        status: contentStatus(item.status),
        sortOrder: item.sort_order,
        isFeatured: item.is_featured,
        seoTitle: item.seo_title,
        seoDescription: item.seo_description,
        canonicalUrl: item.canonical_url,
      });
      const [created] = await db.insert(salesEquipment).values({ ...values, draftVersion: 1, publishedAt: toDate(item.published_at), createdAt: toDate(item.created_at) ?? new Date(), updatedAt: toDate(item.updated_at) ?? new Date() }).returning({ id: salesEquipment.id });
      if (!created) throw new Error(`Không thể tạo thiết bị V1: ${item.slug}`);
      const snapshot = sourceSnapshot(item.id, values);
      await db.insert(salesEquipmentRevisions).values({ salesEquipmentId: created.id, editorId: author.id, versionNumber: 1, snapshot, changeNote: "Import từ backup V1" });
      await db.insert(auditLogs).values({ userId: author.id, action: "sales_equipment.import_v1_local", entityType: "sales_equipment", entityId: created.id, afterData: snapshot });
      summary.equipment.created += 1;
    }

    for (const item of sourceTestimonials) {
      const [existing] = await db.select({ id: testimonials.id }).from(testimonials).where(eq(testimonials.authorName, item.author_name)).limit(1);
      if (existing) {
        summary.testimonials.skipped += 1;
        continue;
      }
      const [created] = await db.insert(testimonials).values({ avatarMediaId: item.avatar_media_id ? mediaIds.get(item.avatar_media_id) ?? null : null, authorName: item.author_name, authorRole: item.author_role, company: item.company, quote: item.quote, rating: item.rating, sortOrder: item.sort_order, isEnabled: item.is_enabled }).returning({ id: testimonials.id });
      if (!created) throw new Error(`Không thể tạo đánh giá V1: ${item.author_name}`);
      await db.insert(auditLogs).values({ userId: author.id, action: "testimonial.import_v1_local", entityType: "testimonial", entityId: created.id, afterData: sourceSnapshot(item.author_name, item) });
      summary.testimonials.created += 1;
    }

    for (const item of sourcePartners) {
      const [existing] = await db.select({ id: partners.id }).from(partners).where(eq(partners.name, item.name)).limit(1);
      if (existing) {
        summary.partners.skipped += 1;
        continue;
      }
      const [created] = await db.insert(partners).values({ logoMediaId: item.logo_media_id ? mediaIds.get(item.logo_media_id) ?? null : null, kind: item.kind, name: item.name, description: item.description, websiteUrl: item.website_url, sortOrder: item.sort_order, isEnabled: item.is_enabled }).returning({ id: partners.id });
      if (!created) throw new Error(`Không thể tạo đối tác V1: ${item.name}`);
      await db.insert(auditLogs).values({ userId: author.id, action: "partner.import_v1_local", entityType: "partner", entityId: created.id, afterData: sourceSnapshot(item.name, item) });
      summary.partners.created += 1;
    }

    for (const item of sourceDownloads) {
      const fileMediaId = item.file_media_id ? mediaIds.get(item.file_media_id) : undefined;
      if (!fileMediaId) {
        summary.downloads.skipped += 1;
        continue;
      }
      const [existing] = await db.select({ id: supportDownloads.id }).from(supportDownloads).where(eq(supportDownloads.fileMediaId, fileMediaId)).limit(1);
      if (existing) {
        summary.downloads.skipped += 1;
        continue;
      }
      const [created] = await db.insert(supportDownloads).values({ fileMediaId, icon: item.icon, title: item.title, description: item.description, meta: item.meta, sortOrder: item.sort_order, isEnabled: item.is_enabled, draftVersion: 1, archivedAt: null }).returning({ id: supportDownloads.id });
      if (!created) throw new Error(`Không thể tạo tài nguyên tải xuống V1: ${item.title}`);
      const snapshot = sourceSnapshot(item.id, { ...item, fileMediaId });
      await db.insert(supportDownloadRevisions).values({ supportDownloadId: created.id, editorId: author.id, versionNumber: 1, snapshot, changeNote: "Import từ backup V1" });
      await db.insert(auditLogs).values({ userId: author.id, action: "support_download.import_v1_local", entityType: "support_download", entityId: created.id, afterData: snapshot });
      summary.downloads.created += 1;
    }

    console.log(`Đã import V1 local: ${JSON.stringify(summary)}`);
  } finally {
    await source.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  console.error(`Import backup V1 thất bại: ${message}`);
  process.exitCode = 1;
});
