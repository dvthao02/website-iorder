import type { EquipmentInput } from "./equipment.contract";
import { publicationDate } from "../shared/publication-date";

/** Giữ ngày xuất bản gốc khi sửa; xuất bản ngay không giữ lịch tương lai. */
export function equipmentPublishedAt(
  values: Pick<EquipmentInput, "status" | "scheduledAt">,
  before: { status: EquipmentInput["status"]; publishedAt: Date | null } | undefined,
  now: Date,
) {
  return publicationDate(values, before, now);
}
