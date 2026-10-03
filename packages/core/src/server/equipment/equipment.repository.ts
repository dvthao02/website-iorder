import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, equipmentGroups, salesEquipment, salesEquipmentRevisions, mediaAssets } from "@iorder/core/db/schema";
import type { EquipmentInput, EquipmentGroupInput } from "./equipment.contract";

export function listEquipmentGroups() {
  return getDb().select().from(equipmentGroups).where(isNull(equipmentGroups.deletedAt)).orderBy(asc(equipmentGroups.sortOrder));
}
export function listEquipment(publicOnly = false) {
  const publicCondition = publicOnly
    ? and(
      eq(equipmentGroups.isEnabled, true),
      or(
        and(eq(salesEquipment.status, "published"), or(isNull(salesEquipment.publishedAt), lte(salesEquipment.publishedAt, new Date()))),
        and(eq(salesEquipment.status, "scheduled"), lte(salesEquipment.scheduledAt, new Date())),
      ),
    )
    : undefined;

  return getDb().select({ item: salesEquipment, group: equipmentGroups, coverKey: mediaAssets.storageKey, coverAlt: mediaAssets.altText })
    .from(salesEquipment).innerJoin(equipmentGroups, eq(salesEquipment.groupId, equipmentGroups.id))
    .leftJoin(mediaAssets, eq(salesEquipment.coverMediaId, mediaAssets.id))
    .where(and(isNull(salesEquipment.deletedAt), isNull(equipmentGroups.deletedAt), publicCondition))
    .orderBy(asc(salesEquipment.sortOrder), asc(salesEquipment.name));
}
export function saveEquipmentGroup(id: string | null, values: EquipmentGroupInput, userId: string) {
  return getDb().transaction(async tx => {
    const [row] = id ? await tx.update(equipmentGroups).set({ ...values, updatedAt: new Date() }).where(and(eq(equipmentGroups.id, id), isNull(equipmentGroups.deletedAt))).returning()
      : await tx.insert(equipmentGroups).values(values).returning();
    if (!row) return undefined;
    await tx.insert(auditLogs).values({ userId, action: id ? "equipment_group.update" : "equipment_group.create", entityType: "equipment_group", entityId: row.id, afterData: values });
    return row.id;
  });
}
export function saveEquipment(id: string | null, values: EquipmentInput, userId: string, changeNote = "Lưu thiết bị từ CMS") {
  return getDb().transaction(async tx => {
    const [before] = id ? await tx.select().from(salesEquipment).where(and(eq(salesEquipment.id, id), isNull(salesEquipment.deletedAt))).for("update") : [];
    if (id && !before) return undefined;
    const draftVersion = (before?.draftVersion ?? 0) + 1;
    const data = { ...values, draftVersion, publishedAt: values.status === "scheduled" ? values.scheduledAt : values.status === "published" ? before?.publishedAt ?? new Date() : null };
    const [row] = id ? await tx.update(salesEquipment).set({ ...data, updatedAt: new Date() }).where(eq(salesEquipment.id, id)).returning()
      : await tx.insert(salesEquipment).values(data).returning();
    await tx.insert(salesEquipmentRevisions).values({ salesEquipmentId: row.id, editorId: userId, versionNumber: draftVersion, snapshot: data, changeNote });
    await tx.insert(auditLogs).values({ userId, action: id ? "equipment.update" : "equipment.create", entityType: "equipment", entityId: row.id, beforeData: before ?? null, afterData: data });
    return row.id;
  });
}
