import { adminPostInputSchema } from "@iorder/core/server/posts/posts.contract";
import { findAdminPostById } from "@iorder/core/server/posts/posts.repository";
import { updateAdminPost } from "@iorder/core/server/posts/posts.service";
import { adminOfferingInputSchema } from "@iorder/core/server/offerings/offering-content.contract";
import { findAdminOfferingById } from "@iorder/core/server/offerings/offerings.repository";
import { updateAdminOffering } from "@iorder/core/server/offerings/offerings.service";
import { pageInputSchema } from "@iorder/core/server/pages/pages.contract";
import { getAdminPages, saveAdminPage } from "@iorder/core/server/pages/pages.service";
import { equipmentInputSchema } from "@iorder/core/server/equipment/equipment.contract";
import { getEquipment, writeEquipment } from "@iorder/core/server/equipment/equipment.service";
import { navigationSchema } from "@iorder/core/server/navigation/navigation.contract";
import { getAdminNavigationById, saveNavigation } from "@iorder/core/server/navigation/navigation.service";
import { adminSupportDownloadInputSchema } from "@iorder/core/server/support/support-downloads.contract";
import { getAdminSupportDownloadById, updateAdminSupportDownload } from "@iorder/core/server/support/support-downloads.service";
import { listRevisions } from "./revisions.repository";
import type { RevisionTarget } from "./revisions.contract";

export async function getRevisionHistory(target: RevisionTarget, id: string) {
  return (await listRevisions(target, id)).map(row => ({ id: row.id, version: row.versionNumber, createdAt: row.createdAt, note: row.changeNote, snapshot: row.snapshot }));
}

export async function restoreRevision(target: RevisionTarget, id: string, revisionId: string, userId: string) {
  const revision = (await listRevisions(target, id)).find(row => row.id === revisionId);
  if (!revision || typeof revision.snapshot !== "object" || !revision.snapshot) return undefined;
  if (target === "navigation") {
    const current = await getAdminNavigationById(id);
    if (!current) return undefined;
    const items = navigationSchema.parse(revision.snapshot);
    return saveNavigation(current.location, items, userId, {
      expectedVersion: current.version,
      changeNote: `Khôi phục phiên bản ${revision.versionNumber}`,
    });
  }
  if (target === "downloads") {
    const current = await getAdminSupportDownloadById(id);
    if (!current) return undefined;
    const values = adminSupportDownloadInputSchema.parse(revision.snapshot);
    return updateAdminSupportDownload(id, values, userId, {
      expectedVersion: current.draftVersion,
      changeNote: `Khôi phục phiên bản ${revision.versionNumber}`,
      allowArchived: true,
    });
  }
  const current = target === "posts" ? await findAdminPostById(id) : target === "offerings" ? await findAdminOfferingById(id) : target === "equipment" ? (await getEquipment()).find(item => item.id === id) : (await getAdminPages()).find(page => page.id === id);
  if (!current) return undefined;
  // Bản import cũ chỉ có một phần dữ liệu; chỉ phục hồi những trường đã được ghi lại.
  const merged = { ...current, ...revision.snapshot, status: current.status };
  const schema = target === "posts" ? adminPostInputSchema : target === "offerings" ? adminOfferingInputSchema : target === "equipment" ? equipmentInputSchema : pageInputSchema;
  const input = Object.fromEntries(Object.keys(schema.shape).filter(key => key in merged).map(key => [key, merged[key as keyof typeof merged]]));
  const note = `Khôi phục phiên bản ${revision.versionNumber}`;
  return target === "posts" ? updateAdminPost(id, input, userId, note) : target === "offerings" ? updateAdminOffering(id, input, userId, note) : target === "equipment" ? writeEquipment("items", id, input, userId, note) : saveAdminPage(id, input, userId);
}
