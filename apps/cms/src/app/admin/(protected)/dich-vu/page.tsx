import { requireAdminPermission } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import { outOfRangeListHref } from "@/lib/admin-list-url";
import { ListingPageShortcut } from "@/components/admin/listing-page-shortcut";

import { OfferingManagerList } from "@/components/admin/offering-manager-list";
import { getAdminOfferingsPage } from "@/lib/backend";

export const dynamic = "force-dynamic";

type Status = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<Status>(["draft", "review", "scheduled", "published", "archived"]);

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string; page?: string; query?: string; status?: string; sort?: string; dir?: string }> }) {
  await requireAdminPermission("offerings.view");
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/dich-vu/moi");
  if (params.edit) redirect(`/admin/dich-vu/${encodeURIComponent(params.edit)}`);
  const status = params.status && statuses.has(params.status as Status) ? params.status as Status : undefined;
  const result = await getAdminOfferingsPage({ page: params.page, query: params.query, status, sort: params.sort, dir: params.dir, type: "service" });
  const correctedHref = outOfRangeListHref("/admin/dich-vu", result, { query: params.query, status, sort: params.sort, dir: params.dir });
  if (correctedHref) redirect(correctedHref);
  return <main className="admin-page"><ListingPageShortcut slugs={["listing-service"]} /><section><OfferingManagerList baseHref="/admin/dich-vu" createHref="/admin/dich-vu/moi" emptyMessage="Chưa tìm thấy dịch vụ phù hợp." initialQuery={params.query ?? ""} initialStatus={status ?? "all"} key={params.query ?? ""} result={result} singularLabel="Dịch vụ" title="Dịch vụ" /></section></main>;
}
