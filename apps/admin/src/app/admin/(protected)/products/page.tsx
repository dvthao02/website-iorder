import { AdminPage } from "@/components/admin/ui/admin-page";
import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import { outOfRangeListHref, validPageSize } from "@/lib/admin-list-url";

import { OfferingManagerList, type OfferingTypeFilter } from "@/components/admin/offering-manager-list";
import { getAdminOfferingsPage } from "@/lib/backend";

export const dynamic = "force-dynamic";

type Status = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<Status>(["draft", "review", "scheduled", "published", "archived"]);
const types = ["software", "solution"] as const;

// Sản phẩm, Giải pháp chung một màn danh sách (tab theo loại); /admin/solutions chuyển về đây.
export default async function OfferingsPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string; page?: string; pageSize?: string; query?: string; status?: string; type?: string; sort?: string; dir?: string }> }) {
  await requireAdminPermission("offerings.view");
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/products/new");
  if (params.edit) redirect(`/admin/products/${encodeURIComponent(params.edit)}`);
  const status = params.status && statuses.has(params.status as Status) ? params.status as Status : undefined;
  const type = types.find((value) => value === params.type);
  const filters = { query: params.query, status, type, sort: params.sort, dir: params.dir, pageSize: validPageSize(params.pageSize) };
  const result = await getAdminOfferingsPage({ page: params.page, ...filters });
  const correctedHref = outOfRangeListHref("/admin/products", result, filters);
  if (correctedHref) redirect(correctedHref);
  const initialType: OfferingTypeFilter = type ?? "all";
  return <AdminPage variant="flush"><section><OfferingManagerList initialQuery={params.query ?? ""} initialStatus={status ?? "all"} initialType={initialType} key={`${params.query ?? ""}:${initialType}`} result={result} /></section></AdminPage>;
}
