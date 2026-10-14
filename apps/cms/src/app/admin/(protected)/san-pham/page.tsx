import { redirect } from "next/navigation";
import { outOfRangeListHref } from "@/lib/admin-list-url";

import { OfferingManagerList } from "@/components/admin/offering-manager-list";
import { getAdminOfferingsPage } from "@/lib/backend";

export const dynamic = "force-dynamic";

type Status = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<Status>(["draft", "review", "scheduled", "published", "archived"]);

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string; page?: string; query?: string; status?: string }> }) {
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/san-pham/moi");
  if (params.edit) redirect(`/admin/san-pham/${encodeURIComponent(params.edit)}`);
  const status = params.status && statuses.has(params.status as Status) ? params.status as Status : undefined;
  const result = await getAdminOfferingsPage({ page: params.page, query: params.query, status, type: "software" });
  const correctedHref = outOfRangeListHref("/admin/san-pham", result, { query: params.query, status });
  if (correctedHref) redirect(correctedHref);
  return <main className="min-h-screen bg-[var(--cms-hover)] p-6 sm:p-10"><section className="mx-auto max-w-7xl"><OfferingManagerList baseHref="/admin/san-pham" createHref="/admin/san-pham/moi" emptyMessage="Chưa tìm thấy sản phẩm phù hợp." initialQuery={params.query ?? ""} initialStatus={status ?? "all"} key={`${params.query ?? ""}:${status ?? "all"}:${params.page ?? "1"}`} result={result} singularLabel="Sản phẩm" title="Sản phẩm" /></section></main>;
}
