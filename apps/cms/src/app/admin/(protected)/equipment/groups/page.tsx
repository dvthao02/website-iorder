import { requireAdminPermission } from "@/lib/admin-guard";
import { EquipmentGroupEditorDetail } from "@/components/admin/equipment-group-editor-detail";
import { getEquipmentGroups } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function EquipmentGroupsPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string }> }) {
  await requireAdminPermission("equipment.view");
  const params = await searchParams;
  const groups = await getEquipmentGroups();
  const group = params.edit ? groups.find((item) => item.id === params.edit) : undefined;
  return <main className="admin-editor-detail-page"><EquipmentGroupEditorDetail group={group} key={group?.id ?? "new"} /></main>;
}
