import { EquipmentEditorDetail } from "@/components/admin/equipment-editor-detail";
import { getEquipmentGroups } from "@/lib/backend";

export default async function NewEquipmentPage() {
  const groups = await getEquipmentGroups();
  return <main className="admin-editor-detail-page"><EquipmentEditorDetail groups={groups} startCreatingItem /></main>;
}
