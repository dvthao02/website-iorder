import { notFound } from "next/navigation";
import { EquipmentEditorDetail } from "@/components/admin/equipment-editor-detail";
import { getEquipment, getEquipmentGroups } from "@/lib/backend";

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, groups, items] = await Promise.all([params, getEquipmentGroups(), getEquipment()]);
  const item = items.find((entry) => entry.id === id);
  if (!item) notFound();
  return <main className="admin-editor-detail-page"><EquipmentEditorDetail groups={groups} item={item} /></main>;
}
