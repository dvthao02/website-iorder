import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import { ListingPageShortcut } from "@/components/admin/listing-page-shortcut";

import { EquipmentManagerList } from "@/components/admin/equipment-manager-list";
import { getEquipmentPageWithGroups } from "@/lib/backend";

export const dynamic = "force-dynamic";

type Status = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<Status>(["draft", "review", "scheduled", "published", "archived"]);

export default async function EquipmentAdminPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string; groupId?: string; page?: string; query?: string; status?: string; tab?: string }> }) {
  await requireAdminPermission("equipment.view");
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/thiet-bi/moi");
  if (params.edit) redirect(`/admin/thiet-bi/${encodeURIComponent(params.edit)}`);
  const status = params.status && statuses.has(params.status as Status) ? params.status as Status : undefined;
  const initialTab = params.tab === "groups" ? "groups" : "items";
  const { equipmentGroups: groups, result } = await getEquipmentPageWithGroups({ groupId: params.groupId, page: params.page, query: params.query, status });
  return <main className="admin-page"><ListingPageShortcut slugs={["listing-equipment"]} /><section><EquipmentManagerList groups={groups} initialGroupId={params.groupId ?? "all"} initialQuery={params.query ?? ""} initialStatus={status ?? "all"} initialTab={initialTab} key={`${initialTab}:${params.groupId ?? "all"}:${params.query ?? ""}:${status ?? "all"}:${params.page ?? "1"}`} result={result} /></section></main>;
}
