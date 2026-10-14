import { notFound } from "next/navigation";
import { EquipmentEditorDetail } from "@/components/admin/equipment-editor-detail";
import { getEquipmentById, getEquipmentGroups } from "@/lib/backend";

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [groups, item] = await Promise.all([getEquipmentGroups(), getEquipmentById(id)]);
  if (!item) notFound();
  return <main className="admin-editor-detail-page"><EquipmentEditorDetail groups={groups} item={item} /></main>;
}
