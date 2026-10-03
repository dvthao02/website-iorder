import Link from "next/link";

import { EquipmentManager } from "@/components/admin/equipment-manager";
import { getEquipmentGroups } from "@/lib/backend";

export default async function EquipmentGroupsPage() {
  const groups = await getEquipmentGroups();
  return <main className="mx-auto max-w-5xl p-6"><Link href="/admin/thiet-bi">← Quay lại thiết bị</Link><h1 className="my-6 text-3xl font-bold">Nhóm thiết bị</h1><p className="mb-6 text-slate-600">Tạo và quản lý các nhóm dùng để phân loại thiết bị.</p><EquipmentManager groups={groups} items={[]} /></main>;
}
