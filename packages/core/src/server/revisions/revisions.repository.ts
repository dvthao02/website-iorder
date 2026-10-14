import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { menuRevisions, offeringRevisions, pageRevisions, postRevisions, salesEquipmentRevisions, supportDownloadRevisions } from "@iorder/core/db/schema";
import type { RevisionTarget } from "./revisions.contract";

export function listRevisions(target: RevisionTarget, id: string) {
  if (target === "posts") return getDb().select().from(postRevisions).where(eq(postRevisions.postId, id)).orderBy(desc(postRevisions.versionNumber));
  if (target === "offerings") return getDb().select().from(offeringRevisions).where(eq(offeringRevisions.offeringId, id)).orderBy(desc(offeringRevisions.versionNumber));
  if (target === "equipment") return getDb().select().from(salesEquipmentRevisions).where(eq(salesEquipmentRevisions.salesEquipmentId, id)).orderBy(desc(salesEquipmentRevisions.versionNumber));
  if (target === "navigation") return getDb().select().from(menuRevisions).where(eq(menuRevisions.menuId, id)).orderBy(desc(menuRevisions.versionNumber));
  if (target === "downloads") return getDb().select().from(supportDownloadRevisions).where(eq(supportDownloadRevisions.supportDownloadId, id)).orderBy(desc(supportDownloadRevisions.versionNumber));
  return getDb().select().from(pageRevisions).where(eq(pageRevisions.pageId, id)).orderBy(desc(pageRevisions.versionNumber));
}

/**
 * Phục hồi chỉ cần đúng revision được chọn. Tránh nạp toàn bộ lịch sử (và cả
 * snapshot JSON) của một nội dung trước khi tìm theo id.
 */
export async function findRevision(target: RevisionTarget, contentId: string, revisionId: string) {
  if (target === "posts") return (await getDb().select().from(postRevisions).where(and(eq(postRevisions.id, revisionId), eq(postRevisions.postId, contentId))).limit(1))[0];
  if (target === "offerings") return (await getDb().select().from(offeringRevisions).where(and(eq(offeringRevisions.id, revisionId), eq(offeringRevisions.offeringId, contentId))).limit(1))[0];
  if (target === "equipment") return (await getDb().select().from(salesEquipmentRevisions).where(and(eq(salesEquipmentRevisions.id, revisionId), eq(salesEquipmentRevisions.salesEquipmentId, contentId))).limit(1))[0];
  if (target === "navigation") return (await getDb().select().from(menuRevisions).where(and(eq(menuRevisions.id, revisionId), eq(menuRevisions.menuId, contentId))).limit(1))[0];
  if (target === "downloads") return (await getDb().select().from(supportDownloadRevisions).where(and(eq(supportDownloadRevisions.id, revisionId), eq(supportDownloadRevisions.supportDownloadId, contentId))).limit(1))[0];
  return (await getDb().select().from(pageRevisions).where(and(eq(pageRevisions.id, revisionId), eq(pageRevisions.pageId, contentId))).limit(1))[0];
}
