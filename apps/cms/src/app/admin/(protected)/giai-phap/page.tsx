import { redirect } from "next/navigation";
import { outOfRangeListHref } from "@/lib/admin-list-url";

import { OfferingManagerList } from "@/components/admin/offering-manager-list";
import { getAdminOfferingsPage } from "@/lib/backend";

export const dynamic = "force-dynamic";

type Status = "draft" | "review" | "scheduled" | "published" | "archived";
const statuses = new Set<Status>(["draft", "review", "scheduled", "published", "archived"]);

export default async function SolutionsPage({ searchParams }: { searchParams: Promise<{ create?: string; edit?: string; page?: string; query?: string; status?: string }> }) {
  const params = await searchParams;
  if (params.create === "1") redirect("/admin/giai-phap/moi");
  if (params.edit) redirect(`/admin/giai-phap/${encodeURIComponent(params.edit)}`);
  const status = params.status && statuses.has(params.status as Status) ? params.status as Status : undefined;
  const result = await getAdminOfferingsPage({ page: params.page, query: params.query, status, type: "solution" });
  const correctedHref = outOfRangeListHref("/admin/giai-phap", result, { query: params.query, status });
  if (correctedHref) redirect(correctedHref);
  return <main className="min-h-screen bg-[var(--cms-hover)] p-6 sm:p-10"><section className="mx-auto max-w-7xl"><OfferingManagerList baseHref="/admin/giai-phap" createHref="/admin/giai-phap/moi" emptyMessage="Chưa tìm thấy giải pháp phù hợp." initialQuery={params.query ?? ""} initialStatus={status ?? "all"} key={`${params.query ?? ""}:${status ?? "all"}:${params.page ?? "1"}`} result={result} singularLabel="Giải pháp" title="Giải pháp" /></section></main>;
}
