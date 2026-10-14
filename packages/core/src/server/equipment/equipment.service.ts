import { z } from "zod";
import { equipmentGroupInputSchema, equipmentInputSchema } from "./equipment.contract";
import { deleteArchivedEquipment, deleteEquipmentGroup, findEquipmentById, listEquipment, listEquipmentGroups, listEquipmentPage, saveEquipment, saveEquipmentGroup } from "./equipment.repository";
import { validateCoverMedia } from "@iorder/core/server/media/media.service";
import { mediaPath } from "@iorder/core/server/media/storage";
import type { AdminListPage, AdminListQuery } from "@iorder/core/server/shared/admin-list.contract";
import { changeEquipmentState } from "./equipment.repository";
import { contentStateRequestSchema } from "../shared/content-version";

export async function changeAdminEquipmentState(id: string, action: "archive" | "restore", userId: string, expectedVersion: number) {
  contentStateRequestSchema.parse({ action, expectedVersion });
  if (!z.string().uuid().safeParse(id).success) return undefined;
  return changeEquipmentState(id, action, userId, expectedVersion);
}

function pick<T extends Record<string, unknown>>(row: T, keys: string[]) {
  return Object.fromEntries(keys.map(key => [key, row[key]]));
}
export async function getEquipmentGroups() {
  return (await listEquipmentGroups()).map(row => ({ id: row.id, ...equipmentGroupInputSchema.parse(pick(row, Object.keys(equipmentGroupInputSchema.shape))) }));
}
export async function getEquipment(publicOnly = false) {
  return (await listEquipment(publicOnly)).map(({ item, group, coverKey, coverAlt }) => ({ id: item.id, ...equipmentInputSchema.parse(pick(item, Object.keys(equipmentInputSchema.shape))), groupName: group.name, coverUrl: coverKey ? mediaPath(coverKey) : null, coverAlt, version: item.draftVersion, updatedAt: item.updatedAt }));
}
export async function getEquipmentPage(query: AdminListQuery & { groupId?: string; status?: "draft" | "review" | "scheduled" | "published" | "archived" }): Promise<AdminListPage<Awaited<ReturnType<typeof getEquipment>>[number]>> {
  const result = await listEquipmentPage(query);
  return {
    ...result,
    items: result.items.map(({ item, group, coverKey, coverAlt }) => ({ id: item.id, ...equipmentInputSchema.parse(pick(item, Object.keys(equipmentInputSchema.shape))), groupName: group.name, coverUrl: coverKey ? mediaPath(coverKey) : null, coverAlt, version: item.draftVersion, updatedAt: item.updatedAt })),
  };
}
export async function getEquipmentById(id: string) {
  if (!z.string().uuid().safeParse(id).success) return undefined;
  const row = await findEquipmentById(id);
  return row ? { id: row.item.id, ...equipmentInputSchema.parse(pick(row.item, Object.keys(equipmentInputSchema.shape))), groupName: row.group.name, coverUrl: row.coverKey ? mediaPath(row.coverKey) : null, coverAlt: row.coverAlt, version: row.item.draftVersion, updatedAt: row.item.updatedAt } : undefined;
}
export async function writeEquipment(kind: "groups" | "items", id: string | null, input: unknown, userId: string, changeNote?: string, expectedVersion?: number) {
  if (kind === "groups") {
    const values = equipmentGroupInputSchema.parse(input);
    await validateCoverMedia(values.coverMediaId);
    return saveEquipmentGroup(id, values, userId);
  }
  const values = equipmentInputSchema.parse(input);
  await validateCoverMedia(values.coverMediaId);
  // Repository kiểm tra nhóm trong cùng transaction ghi, tránh race với soft-delete.
  return saveEquipment(id, values, userId, changeNote, expectedVersion);
}

export async function deleteArchivedAdminEquipment(id: string, userId: string, expectedVersion?: number) {
  if (!z.string().uuid().safeParse(id).success) return undefined;
  return deleteArchivedEquipment(id, userId, expectedVersion);
}

export async function deleteAdminEquipmentGroup(id: string, userId: string) {
  if (!z.string().uuid().safeParse(id).success) return undefined;
  return deleteEquipmentGroup(id, userId);
}
