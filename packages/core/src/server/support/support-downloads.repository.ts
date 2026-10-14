import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { auditLogs, mediaAssets, supportDownloadRevisions, supportDownloads } from "@iorder/core/db/schema";

import type { AdminSupportDownloadInput } from "./support-downloads.contract";

const adminSelection = {
  id: supportDownloads.id,
  fileMediaId: supportDownloads.fileMediaId,
  icon: supportDownloads.icon,
  title: supportDownloads.title,
  description: supportDownloads.description,
  meta: supportDownloads.meta,
  sortOrder: supportDownloads.sortOrder,
  isEnabled: supportDownloads.isEnabled,
  draftVersion: supportDownloads.draftVersion,
  archivedAt: supportDownloads.archivedAt,
  originalName: mediaAssets.originalName,
  mimeType: mediaAssets.mimeType,
  storageKey: mediaAssets.storageKey,
};

type RevisionWrite = {
  changeNote: string;
  editorId: string;
  snapshot: AdminSupportDownloadInput;
  versionNumber: number;
};

function rowSnapshot(row: typeof supportDownloads.$inferSelect): AdminSupportDownloadInput {
  return {
    fileMediaId: row.fileMediaId,
    icon: row.icon,
    title: row.title,
    description: row.description,
    meta: row.meta,
    sortOrder: row.sortOrder,
    isEnabled: row.isEnabled,
  };
}

export async function listEnabledSupportDownloads() {
  return getDb()
    .select({
      id: supportDownloads.id,
      icon: supportDownloads.icon,
      title: supportDownloads.title,
      description: supportDownloads.description,
      meta: supportDownloads.meta,
      storageKey: mediaAssets.storageKey,
    })
    .from(supportDownloads)
    .innerJoin(mediaAssets, eq(supportDownloads.fileMediaId, mediaAssets.id))
    .where(and(eq(supportDownloads.isEnabled, true), isNull(supportDownloads.archivedAt), isNull(supportDownloads.deletedAt), isNotNull(supportDownloads.fileMediaId)))
    .orderBy(asc(supportDownloads.sortOrder), asc(supportDownloads.title));
}

export async function listAdminSupportDownloads() {
  return getDb()
    .select(adminSelection)
    .from(supportDownloads)
    .leftJoin(mediaAssets, eq(supportDownloads.fileMediaId, mediaAssets.id))
    .where(isNull(supportDownloads.deletedAt))
    .orderBy(asc(supportDownloads.sortOrder), asc(supportDownloads.title));
}

export async function findAdminSupportDownloadById(id: string) {
  const [download] = await getDb()
    .select(adminSelection)
    .from(supportDownloads)
    .leftJoin(mediaAssets, eq(supportDownloads.fileMediaId, mediaAssets.id))
    .where(and(eq(supportDownloads.id, id), isNull(supportDownloads.deletedAt)))
    .limit(1);
  return download;
}

export function createSupportDownloadWithRevision(values: AdminSupportDownloadInput, revision: RevisionWrite) {
  return getDb().transaction(async (tx) => {
    const [created] = await tx.insert(supportDownloads).values({ ...values, draftVersion: revision.versionNumber }).returning({ id: supportDownloads.id });
    if (!created) throw new Error("Không thể tạo tài nguyên tải xuống.");
    await tx.insert(supportDownloadRevisions).values({
      supportDownloadId: created.id,
      editorId: revision.editorId,
      versionNumber: revision.versionNumber,
      snapshot: revision.snapshot,
      changeNote: revision.changeNote,
    });
    await tx.insert(auditLogs).values({
      userId: revision.editorId,
      action: "support_download.create",
      entityType: "support_download",
      entityId: created.id,
      afterData: revision.snapshot,
    });
    return created.id;
  });
}

export function updateSupportDownloadWithRevision(id: string, values: AdminSupportDownloadInput, revision: RevisionWrite) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(supportDownloads).where(and(eq(supportDownloads.id, id), isNull(supportDownloads.deletedAt))).limit(1).for("update");
    if (!before || before.draftVersion !== revision.versionNumber - 1) return undefined;
    const [updated] = await tx.update(supportDownloads)
      .set({ ...values, draftVersion: revision.versionNumber, updatedAt: new Date() })
      .where(and(eq(supportDownloads.id, id), isNull(supportDownloads.deletedAt), eq(supportDownloads.draftVersion, revision.versionNumber - 1)))
      .returning({ id: supportDownloads.id });
    if (!updated) return undefined;
    await tx.insert(supportDownloadRevisions).values({
      supportDownloadId: id,
      editorId: revision.editorId,
      versionNumber: revision.versionNumber,
      snapshot: revision.snapshot,
      changeNote: revision.changeNote,
    });
    await tx.insert(auditLogs).values({
      userId: revision.editorId,
      action: "support_download.update",
      entityType: "support_download",
      entityId: id,
      beforeData: rowSnapshot(before),
      afterData: revision.snapshot,
    });
    return id;
  });
}

export function setSupportDownloadArchived(id: string, archived: boolean, userId: string, expectedVersion?: number) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(supportDownloads).where(and(eq(supportDownloads.id, id), isNull(supportDownloads.deletedAt))).limit(1).for("update");
    if (!before || (expectedVersion !== undefined && before.draftVersion !== expectedVersion)) return undefined;
    if (Boolean(before.archivedAt) === archived) return id;

    const versionNumber = before.draftVersion + 1;
    const afterSnapshot = { ...rowSnapshot(before), isEnabled: false };
    const [updated] = await tx.update(supportDownloads).set({
      archivedAt: archived ? new Date() : null,
      isEnabled: false,
      draftVersion: versionNumber,
      updatedAt: new Date(),
    }).where(and(eq(supportDownloads.id, id), isNull(supportDownloads.deletedAt), eq(supportDownloads.draftVersion, before.draftVersion))).returning({ id: supportDownloads.id });
    if (!updated) return undefined;
    await tx.insert(supportDownloadRevisions).values({
      supportDownloadId: id,
      editorId: userId,
      versionNumber,
      snapshot: afterSnapshot,
      changeNote: archived ? "Lưu trữ tài nguyên" : "Khôi phục tài nguyên",
    });
    await tx.insert(auditLogs).values({
      userId,
      action: archived ? "support_download.archive" : "support_download.restore",
      entityType: "support_download",
      entityId: id,
      beforeData: { ...rowSnapshot(before), archivedAt: before.archivedAt },
      afterData: { ...afterSnapshot, archivedAt: archived ? "now" : null },
    });
    return id;
  });
}

/** Chỉ cho xóa mềm tài nguyên đã lưu trữ để giữ revision và audit. */
export function deleteArchivedSupportDownload(id: string, userId: string, expectedVersion?: number) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(supportDownloads)
      .where(and(eq(supportDownloads.id, id), isNotNull(supportDownloads.archivedAt), isNull(supportDownloads.deletedAt)))
      .for("update");
    if (!before || (expectedVersion !== undefined && before.draftVersion !== expectedVersion)) return undefined;

    const [deleted] = await tx.update(supportDownloads).set({ deletedAt: new Date(), updatedAt: new Date(), isEnabled: false }).where(and(eq(supportDownloads.id, id), isNull(supportDownloads.deletedAt))).returning({ id: supportDownloads.id });
    if (!deleted) return undefined;
    await tx.insert(auditLogs).values({
      userId,
      action: "support_download.delete",
      entityType: "support_download",
      entityId: deleted.id,
      beforeData: { ...rowSnapshot(before), archivedAt: before.archivedAt },
    });
    return deleted.id;
  });
}
