import { z } from "zod";
import { equipmentGroupInputSchema, equipmentInputSchema } from "./equipment.contract";
import { listEquipment, listEquipmentGroups, saveEquipment, saveEquipmentGroup } from "./equipment.repository";
import { validateCoverMedia } from "@iorder/core/server/media/media.service";
import { mediaPath } from "@iorder/core/server/media/storage";

function pick<T extends Record<string, unknown>>(row: T, keys: string[]) {
  return Object.fromEntries(keys.map(key => [key, row[key]]));
}
export async function getEquipmentGroups() {
  return (await listEquipmentGroups()).map(row => ({ id: row.id, ...equipmentGroupInputSchema.parse(pick(row, Object.keys(equipmentGroupInputSchema.shape))) }));
}
export async function getEquipment(publicOnly = false) {
  return (await listEquipment(publicOnly)).map(({ item, group, coverKey, coverAlt }) => ({ id: item.id, ...equipmentInputSchema.parse(pick(item, Object.keys(equipmentInputSchema.shape))), groupName: group.name, coverUrl: coverKey ? mediaPath(coverKey) : null, coverAlt, version: item.draftVersion, updatedAt: item.updatedAt }));
}
export async function writeEquipment(kind: "groups" | "items", id: string | null, input: unknown, userId: string, changeNote?: string) {
  if (kind === "groups") {
    const values = equipmentGroupInputSchema.parse(input);
    await validateCoverMedia(values.coverMediaId);
    return saveEquipmentGroup(id, values, userId);
  }
  const values = equipmentInputSchema.parse(input);
  await validateCoverMedia(values.coverMediaId);
  if (!(await listEquipmentGroups()).some(group => group.id === values.groupId)) throw new z.ZodError([{ code: "custom", path: ["groupId"], message: "Nhóm thiết bị không tồn tại." }]);
  return saveEquipment(id, values, userId, changeNote);
}
