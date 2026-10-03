import { desc, eq } from "drizzle-orm";
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
