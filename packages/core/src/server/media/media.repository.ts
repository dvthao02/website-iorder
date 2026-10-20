import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import {
  auditLogs,
  equipmentGroups,
  mediaAssets,
  offerings,
  pageBlocks,
  pages,
  partners,
  posts,
  salesEquipment,
  siteProfile,
  siteSettings,
  supportDownloads,
  testimonials,
} from "@iorder/core/db/schema";
import type { MediaMetadata } from "./media.contract";
import { mediaPath } from "./storage";
import type { MediaUsage } from "./media.contract";
import type { MediaListQuery } from "./media.contract";
import { toAdminListPage } from "../shared/admin-list.contract";
import { assertContentVersion } from "../shared/content-version";
import { listOrder, vietnameseText } from "../shared/list-order";

export async function listMediaAssetsPage(query: MediaListQuery, database = getDb()) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const condition = and(
    isNull(mediaAssets.deletedAt),
    query.type === "images" ? inArray(mediaAssets.mimeType, ["image/png", "image/jpeg", "image/webp"])
      : query.type === "missing_alt" ? and(inArray(mediaAssets.mimeType, ["image/png", "image/jpeg", "image/webp"]), or(isNull(mediaAssets.altText), eq(mediaAssets.altText, "")))
      : query.type === "documents" ? inArray(mediaAssets.mimeType, ["application/pdf", "application/zip"]) : undefined,
    keyword ? or(ilike(mediaAssets.originalName, keyword), ilike(mediaAssets.altText, keyword), ilike(mediaAssets.caption, keyword)) : undefined,
  );
  return database.transaction(async (tx) => {
    const items = await tx.select().from(mediaAssets).where(condition).orderBy(...listOrder({ createdAt: mediaAssets.createdAt, name: vietnameseText(mediaAssets.originalName), size: mediaAssets.fileSize }, query, [desc(mediaAssets.createdAt), asc(mediaAssets.id)])).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const totals = await tx.select({ total: count() }).from(mediaAssets).where(condition);
    return toAdminListPage(items, query, totals[0]?.total ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export function listMediaAssets() {
  return getDb().select().from(mediaAssets).where(isNull(mediaAssets.deletedAt)).orderBy(desc(mediaAssets.createdAt));
}

export async function findMediaAsset(id: string) {
  const [asset] = await getDb().select().from(mediaAssets).where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt))).limit(1);
  return asset;
}

export function insertUploadedMedia(values: typeof mediaAssets.$inferInsert, userId: string) {
  return getDb().transaction(async (tx) => {
    const [asset] = await tx.insert(mediaAssets).values(values).returning();
    await tx.insert(auditLogs).values({ userId, action: "media.upload", entityType: "media", entityId: asset.id,
      afterData: { originalName: asset.originalName, fileSize: asset.fileSize, mimeType: asset.mimeType } });
    return asset;
  });
}

export function updateMediaMetadata(id: string, input: MediaMetadata, userId: string, expectedVersion: number) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(mediaAssets).where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt))).for("update");
    if (!before) return undefined;
    assertContentVersion(before.version, expectedVersion);
    const [after] = await tx.update(mediaAssets).set({ ...input, version: before.version + 1, updatedAt: new Date() })
      .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt))).returning();
    await tx.insert(auditLogs).values({ userId, action: "media.update", entityType: "media", entityId: id,
      beforeData: { altText: before.altText, caption: before.caption }, afterData: input });
    return after;
  });
}

/** Đánh dấu xóa trước; worker sẽ dọn object storage sau thời gian lưu giữ. */
export function queueMediaAssetDeletion(id: string, userId: string) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(mediaAssets).where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt))).for("update");
    if (!before) return undefined;
    const [queued] = await tx.update(mediaAssets).set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt))).returning({ id: mediaAssets.id });
    if (!queued) return undefined;
    await tx.insert(auditLogs).values({
      userId,
      action: "media.delete_queue",
      entityType: "media",
      entityId: queued.id,
      beforeData: { originalName: before.originalName, fileSize: before.fileSize, mimeType: before.mimeType, storageKey: before.storageKey },
    });
    return queued;
  });
}

export function listQueuedMediaForCleanup(before: Date, limit = 100) {
  return getDb().select().from(mediaAssets)
    .where(and(isNotNull(mediaAssets.deletedAt), lte(mediaAssets.deletedAt, before)))
    .orderBy(mediaAssets.deletedAt)
    .limit(limit);
}

/** Chỉ worker dọn rác gọi hàm này sau khi object storage đã xóa thành công. */
export function permanentlyDeleteQueuedMediaAsset(id: string) {
  return getDb().transaction(async (tx) => {
    const [asset] = await tx.select().from(mediaAssets).where(and(eq(mediaAssets.id, id), isNotNull(mediaAssets.deletedAt))).for("update");
    if (!asset) return undefined;
    const [deleted] = await tx.delete(mediaAssets).where(eq(mediaAssets.id, id)).returning({ id: mediaAssets.id });
    return deleted?.id;
  });
}

export function listPublishingMediaUsage(mediaId: string, database = getDb()) {
  return database.select({ id: siteSettings.id }).from(siteSettings).where(and(eq(siteSettings.key, "publishing"), sql<boolean>`${siteSettings.value} ->> 'defaultOgMediaId' = ${mediaId}`));
}

export async function collectMediaUsage(mediaId: string): Promise<MediaUsage[]> {
  // Ảnh chèn trong nội dung soạn thảo được lưu bằng đường dẫn /media/…, không phải mã tệp:
  // tìm đúng chuỗi đường dẫn (position, không dùng LIKE để tránh ký tự đại diện).
  const [asset] = await getDb().select({ storageKey: mediaAssets.storageKey }).from(mediaAssets).where(eq(mediaAssets.id, mediaId)).limit(1);
  const url = asset ? mediaPath(asset.storageKey) : null;
  const [postContentRows, richBlockRows] = url ? await Promise.all([
    getDb().select({ id: posts.id, label: posts.title }).from(posts).where(and(isNull(posts.deletedAt), sql<boolean>`position(${url} in ${posts.content}::text) > 0`)),
    getDb().select({ id: pageBlocks.id, label: pages.title }).from(pageBlocks).innerJoin(pages, eq(pageBlocks.pageId, pages.id))
      .where(and(isNull(pages.deletedAt), sql<boolean>`position(${url} in ${pageBlocks.data}::text) > 0`)),
  ]) : [[], []];
  const [pageRows, postRows, offeringRows, groupRows, equipmentRows, partnerRows, testimonialRows, profileRows, downloadRows, publishingRows] = await Promise.all([
    getDb().select({ id: pageBlocks.id, label: pages.title }).from(pageBlocks).innerJoin(pages, eq(pageBlocks.pageId, pages.id))
      .where(and(isNull(pages.deletedAt), sql<boolean>`${pageBlocks.data} ->> 'mediaId' = ${mediaId}`)),
    getDb().select({ id: posts.id, label: posts.title }).from(posts).where(and(eq(posts.coverMediaId, mediaId), isNull(posts.deletedAt))),
    getDb().select({ id: offerings.id, label: offerings.title }).from(offerings).where(and(eq(offerings.coverMediaId, mediaId), isNull(offerings.deletedAt))),
    getDb().select({ id: equipmentGroups.id, label: equipmentGroups.name }).from(equipmentGroups).where(and(eq(equipmentGroups.coverMediaId, mediaId), isNull(equipmentGroups.deletedAt))),
    getDb().select({ id: salesEquipment.id, label: salesEquipment.name }).from(salesEquipment).where(and(eq(salesEquipment.coverMediaId, mediaId), isNull(salesEquipment.deletedAt))),
    getDb().select({ id: partners.id, label: partners.name }).from(partners).where(and(eq(partners.logoMediaId, mediaId), isNull(partners.deletedAt))),
    getDb().select({ id: testimonials.id, label: testimonials.authorName }).from(testimonials).where(and(eq(testimonials.avatarMediaId, mediaId), isNull(testimonials.deletedAt))),
    getDb().select({ id: siteProfile.id, label: siteProfile.companyName }).from(siteProfile).where(eq(siteProfile.logoMediaId, mediaId)),
    getDb().select({ id: supportDownloads.id, label: supportDownloads.title }).from(supportDownloads).where(and(eq(supportDownloads.fileMediaId, mediaId), isNull(supportDownloads.deletedAt))),
    listPublishingMediaUsage(mediaId),
  ]);

  return [
    ...pageRows.map((row) => ({ entityType: "page_block", entityId: row.id, label: row.label, location: "Khối hình ảnh của trang" })),
    ...postRows.map((row) => ({ entityType: "post", entityId: row.id, label: row.label, location: "Ảnh bìa bài viết" })),
    ...offeringRows.map((row) => ({ entityType: "offering", entityId: row.id, label: row.label, location: "Ảnh bìa catalog" })),
    ...groupRows.map((row) => ({ entityType: "equipment_group", entityId: row.id, label: row.label, location: "Ảnh nhóm thiết bị" })),
    ...equipmentRows.map((row) => ({ entityType: "equipment", entityId: row.id, label: row.label, location: "Ảnh thiết bị" })),
    ...partnerRows.map((row) => ({ entityType: "partner", entityId: row.id, label: row.label, location: "Logo đối tác" })),
    ...testimonialRows.map((row) => ({ entityType: "testimonial", entityId: row.id, label: row.label, location: "Ảnh khách hàng" })),
    ...profileRows.map((row) => ({ entityType: "site_profile", entityId: row.id, label: row.label, location: "Logo website" })),
    ...downloadRows.map((row) => ({ entityType: "support_download", entityId: row.id, label: row.label, location: "Tệp hỗ trợ tải xuống" })),
    ...publishingRows.map((row) => ({ entityType: "site_setting", entityId: row.id, label: "Cấu hình SEO & Xuất bản", location: "Ảnh chia sẻ mặc định" })),
    ...postContentRows.map((row) => ({ entityType: "post_content", entityId: row.id, label: row.label, location: "Ảnh trong nội dung bài viết" })),
    ...richBlockRows.map((row) => ({ entityType: "page_block_content", entityId: row.id, label: row.label, location: "Ảnh trong khối văn bản của trang" })),
  ];
}
