import { and, asc, count, desc, eq, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, equipmentGroups, salesEquipment, salesEquipmentRevisions, mediaAssets } from "@iorder/core/db/schema";
import { ContentVersionConflictError } from "../shared/content-version";
import type { EquipmentInput, EquipmentGroupInput } from "./equipment.contract";
import { equipmentPublishedAt } from "./equipment-publication";
import { assertEquipmentVersion } from "./equipment-version";
import { contentStateAfterAction, contentStateChangeNotes, contentStateRequestSchema, type ContentStateAction } from "../shared/content-version";
import { toAdminListPage, type AdminListQuery } from "@iorder/core/server/shared/admin-list.contract";
import { listOrder, workflowStatusRank, vietnameseText } from "../shared/list-order";

export function listEquipmentGroups() {
  return getDb().select().from(equipmentGroups).where(isNull(equipmentGroups.deletedAt)).orderBy(asc(equipmentGroups.sortOrder), asc(equipmentGroups.id));
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

type EquipmentListQuery = AdminListQuery & {
  groupId?: string;
  status?: "draft" | "review" | "scheduled" | "published" | "archived";
};

function equipmentListCondition(query: EquipmentListQuery) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  return and(
    isNull(salesEquipment.deletedAt),
    isNull(equipmentGroups.deletedAt),
    query.groupId ? eq(salesEquipment.groupId, query.groupId) : undefined,
    query.status ? eq(salesEquipment.status, query.status) : undefined,
    keyword ? or(ilike(salesEquipment.name, keyword), ilike(salesEquipment.slug, keyword), ilike(salesEquipment.modelCode, keyword)) : undefined,
  );
}

export async function listEquipmentPage(query: EquipmentListQuery, database = getDb()) {
  const condition = equipmentListCondition(query);
  return database.transaction(async (tx) => {
    const rows = await tx.select({ item: salesEquipment, group: equipmentGroups, coverKey: mediaAssets.storageKey, coverAlt: mediaAssets.altText }).from(salesEquipment).innerJoin(equipmentGroups, eq(salesEquipment.groupId, equipmentGroups.id)).leftJoin(mediaAssets, eq(salesEquipment.coverMediaId, mediaAssets.id)).where(condition).orderBy(...listOrder({ name: vietnameseText(salesEquipment.name), group: vietnameseText(equipmentGroups.name), priceVnd: salesEquipment.priceVnd, status: workflowStatusRank(salesEquipment.status), updatedAt: salesEquipment.updatedAt }, query, [desc(salesEquipment.updatedAt), asc(salesEquipment.sortOrder), asc(salesEquipment.name), asc(salesEquipment.id)])).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const totals = await tx.select({ total: count() }).from(salesEquipment).innerJoin(equipmentGroups, eq(salesEquipment.groupId, equipmentGroups.id)).where(condition);
    return toAdminListPage(rows, query, totals[0]?.total ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function findEquipmentById(id: string) {
  const [row] = await getDb().select({ item: salesEquipment, group: equipmentGroups, coverKey: mediaAssets.storageKey, coverAlt: mediaAssets.altText })
    .from(salesEquipment).innerJoin(equipmentGroups, eq(salesEquipment.groupId, equipmentGroups.id)).leftJoin(mediaAssets, eq(salesEquipment.coverMediaId, mediaAssets.id))
    .where(and(eq(salesEquipment.id, id), isNull(salesEquipment.deletedAt), isNull(equipmentGroups.deletedAt))).limit(1);
  return row;
}
export async function findEquipmentGroupVisibility(id: string) {
  const [row] = await getDb().select({ isEnabled: equipmentGroups.isEnabled }).from(equipmentGroups).where(and(eq(equipmentGroups.id, id), isNull(equipmentGroups.deletedAt))).limit(1);
  return row?.isEnabled;
}
// onlyIfHidden: callers without publish permission may only touch hidden groups;
// the condition sits in the UPDATE itself so a concurrent enable cannot slip through.
export function saveEquipmentGroup(id: string | null, values: EquipmentGroupInput, userId: string, database = getDb(), options: { onlyIfHidden?: boolean; expectedVersion?: number } = {}) {
  return database.transaction(async tx => {
    const [row] = id ? await tx.update(equipmentGroups).set({ ...values, version: sql`${equipmentGroups.version} + 1`, updatedAt: new Date() }).where(and(eq(equipmentGroups.id, id), isNull(equipmentGroups.deletedAt), options.onlyIfHidden ? eq(equipmentGroups.isEnabled, false) : undefined, options.expectedVersion !== undefined ? eq(equipmentGroups.version, options.expectedVersion) : undefined)).returning()
      : await tx.insert(equipmentGroups).values(values).returning();
    // Không cập nhật được: còn bản ghi nhưng lệch version → 409; ngược lại giữ nghĩa cũ (không tìm thấy/đang hiển thị).
    if (!row && id && options.expectedVersion !== undefined) {
      const [current] = await tx.select({ version: equipmentGroups.version }).from(equipmentGroups).where(and(eq(equipmentGroups.id, id), isNull(equipmentGroups.deletedAt)));
      if (current && current.version !== options.expectedVersion) throw new ContentVersionConflictError();
    }
    if (!row) return undefined;
    await tx.insert(auditLogs).values({ userId, action: id ? "equipment_group.update" : "equipment_group.create", entityType: "equipment_group", entityId: row.id, afterData: values });
    return row.id;
  });
}
export function saveEquipment(id: string | null, values: EquipmentInput, userId: string, changeNote = "Lưu thiết bị từ CMS", expectedVersion?: number, database = getDb()) {
  return database.transaction(async tx => {
    // Đồng bộ với khóa FOR UPDATE khi xóa nhóm; FK không ngăn soft-delete.
    const [group] = await tx.select({ id: equipmentGroups.id }).from(equipmentGroups)
      .where(and(eq(equipmentGroups.id, values.groupId), isNull(equipmentGroups.deletedAt))).for("share");
    if (!group) throw new z.ZodError([{ code: "custom", path: ["groupId"], message: "Nhóm thiết bị không còn tồn tại. Vui lòng chọn nhóm khác." }]);
    const [before] = id ? await tx.select().from(salesEquipment).where(and(eq(salesEquipment.id, id), isNull(salesEquipment.deletedAt))).for("update") : [];
    if (id && !before) return undefined;
    if (before) assertEquipmentVersion(before.draftVersion, expectedVersion);
    const draftVersion = (before?.draftVersion ?? 0) + 1;
    const data = { ...values, draftVersion, publishedAt: equipmentPublishedAt(values, before, new Date()) };
    const [row] = id ? await tx.update(salesEquipment).set({ ...data, updatedAt: new Date() }).where(eq(salesEquipment.id, id)).returning()
      : await tx.insert(salesEquipment).values(data).returning();
    await tx.insert(salesEquipmentRevisions).values({ salesEquipmentId: row.id, editorId: userId, versionNumber: draftVersion, snapshot: data, changeNote });
    await tx.insert(auditLogs).values({ userId, action: id ? "equipment.update" : "equipment.create", entityType: "equipment", entityId: row.id, beforeData: before ?? null, afterData: data });
    return row.id;
  });
}

export function changeEquipmentState(id: string, action: ContentStateAction, userId: string, expectedVersion: number, database = getDb()) {
  contentStateRequestSchema.parse({ action, expectedVersion });
  return database.transaction(async tx => {
    const [before] = await tx.select().from(salesEquipment).where(and(eq(salesEquipment.id, id), isNull(salesEquipment.deletedAt))).for("update");
    if (!before) return undefined;
    const status = contentStateAfterAction(before, action, expectedVersion);
    const now = new Date();
    const [row] = await tx.update(salesEquipment).set({ status, draftVersion: before.draftVersion + 1, publishedAt: equipmentPublishedAt({ status, scheduledAt: before.scheduledAt }, before, now), updatedAt: now }).where(eq(salesEquipment.id, id)).returning();
    await tx.insert(salesEquipmentRevisions).values({ salesEquipmentId: id, editorId: userId, versionNumber: row.draftVersion, snapshot: row, changeNote: `${contentStateChangeNotes[action]} thiết bị từ CMS` });
    await tx.insert(auditLogs).values({ userId, action: "equipment.update", entityType: "equipment", entityId: id, beforeData: before, afterData: row });
    return { id: row.id, status: row.status, version: row.draftVersion };
  });
}

export function deleteArchivedEquipment(id: string, userId: string, expectedVersion?: number, database = getDb()) {
  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(salesEquipment)
      .where(and(eq(salesEquipment.id, id), eq(salesEquipment.status, "archived"), isNull(salesEquipment.deletedAt)))
      .for("update");
    if (!existing) return undefined;
    assertEquipmentVersion(existing.draftVersion, expectedVersion);

    const [deleted] = await tx
      .update(salesEquipment)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(salesEquipment.id, id))
      .returning({ id: salesEquipment.id, slug: salesEquipment.slug });
    if (!deleted) return undefined;

    await tx.insert(auditLogs).values({
      userId,
      action: "equipment.delete",
      entityType: "equipment",
      entityId: deleted.id,
      beforeData: existing,
    });
    return deleted;
  });
}

export type EquipmentGroupDeleteResult = { id: string } | { blockedBy: "items" } | undefined;

/** Không xoá nhóm còn thiết bị để tránh làm các bản ghi con mất vị trí hiển thị. */
export function deleteEquipmentGroup(id: string, userId: string, database = getDb()): Promise<EquipmentGroupDeleteResult> {
  return database.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(equipmentGroups)
      .where(and(eq(equipmentGroups.id, id), isNull(equipmentGroups.deletedAt)))
      .for("update");
    if (!before) return undefined;

    const [item] = await tx
      .select({ id: salesEquipment.id })
      .from(salesEquipment)
      .where(and(eq(salesEquipment.groupId, id), isNull(salesEquipment.deletedAt)))
      .limit(1);
    if (item) return { blockedBy: "items" };

    const [deleted] = await tx
      .update(equipmentGroups)
      .set({ deletedAt: new Date(), updatedAt: new Date(), isEnabled: false })
      .where(and(eq(equipmentGroups.id, id), isNull(equipmentGroups.deletedAt)))
      .returning({ id: equipmentGroups.id });
    if (!deleted) return undefined;

    await tx.insert(auditLogs).values({
      userId,
      action: "equipment_group.delete",
      entityType: "equipment_group",
      entityId: deleted.id,
      beforeData: before,
    });
    return deleted;
  });
}
