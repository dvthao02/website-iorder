import { and, desc, eq, isNull, sql } from "drizzle-orm";
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
  supportDownloads,
  testimonials,
} from "@iorder/core/db/schema";
import type { MediaMetadata } from "./media.contract";
import type { MediaUsage } from "./media.contract";

export function listMediaAssets() {
  return getDb().select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt));
}

export async function findMediaAsset(id: string) {
  const [asset] = await getDb().select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
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

export function updateMediaMetadata(id: string, input: MediaMetadata, userId: string) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, id)).for("update");
    if (!before) return undefined;
    const [after] = await tx.update(mediaAssets).set({ ...input, updatedAt: new Date() })
      .where(eq(mediaAssets.id, id)).returning();
    await tx.insert(auditLogs).values({ userId, action: "media.update", entityType: "media", entityId: id,
      beforeData: { altText: before.altText, caption: before.caption }, afterData: input });
    return after;
  });
}

export async function collectMediaUsage(mediaId: string): Promise<MediaUsage[]> {
  const [pageRows, postRows, offeringRows, groupRows, equipmentRows, partnerRows, testimonialRows, profileRows, downloadRows] = await Promise.all([
    getDb().select({ id: pageBlocks.id, label: pages.title }).from(pageBlocks).innerJoin(pages, eq(pageBlocks.pageId, pages.id))
      .where(and(isNull(pages.deletedAt), sql<boolean>`${pageBlocks.data} ->> 'mediaId' = ${mediaId}`)),
    getDb().select({ id: posts.id, label: posts.title }).from(posts).where(and(eq(posts.coverMediaId, mediaId), isNull(posts.deletedAt))),
    getDb().select({ id: offerings.id, label: offerings.title }).from(offerings).where(and(eq(offerings.coverMediaId, mediaId), isNull(offerings.deletedAt))),
    getDb().select({ id: equipmentGroups.id, label: equipmentGroups.name }).from(equipmentGroups).where(and(eq(equipmentGroups.coverMediaId, mediaId), isNull(equipmentGroups.deletedAt))),
    getDb().select({ id: salesEquipment.id, label: salesEquipment.name }).from(salesEquipment).where(and(eq(salesEquipment.coverMediaId, mediaId), isNull(salesEquipment.deletedAt))),
    getDb().select({ id: partners.id, label: partners.name }).from(partners).where(eq(partners.logoMediaId, mediaId)),
    getDb().select({ id: testimonials.id, label: testimonials.authorName }).from(testimonials).where(eq(testimonials.avatarMediaId, mediaId)),
    getDb().select({ id: siteProfile.id, label: siteProfile.companyName }).from(siteProfile).where(eq(siteProfile.logoMediaId, mediaId)),
    getDb().select({ id: supportDownloads.id, label: supportDownloads.title }).from(supportDownloads).where(eq(supportDownloads.fileMediaId, mediaId)),
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
  ];
}
