import { redirect } from "next/navigation";
import { EquipmentManagerList } from "@/components/admin/equipment-manager-list";
import { getEquipment, getEquipmentGroups } from "@/lib/backend";
export const dynamic = "force-dynamic";
export default async function EquipmentAdminPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string }> }) {
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/thiet-bi/moi");
  if (params.edit) redirect(`/admin/thiet-bi/${encodeURIComponent(params.edit)}`);
  const [groups, items] = await Promise.all([getEquipmentGroups(), getEquipment()]);
  return <main className="min-h-screen bg-slate-100 p-6 sm:p-10"><section className="mx-auto max-w-7xl"><EquipmentManagerList groups={groups} items={items} /></section></main>;
}
