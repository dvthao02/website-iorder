import { requireAdminPermission } from "@/lib/admin-guard";
import { PagesManager } from "@/components/admin/pages-manager";
import { getAdminPagesPage } from "@/lib/backend";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PagesManagerPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string; query?: string; status?: string; sort?: string; dir?: string }> }) {
  await requireAdminPermission("pages.view");
  const params = await searchParams;
  const result = await getAdminPagesPage(params);
  if (result.page > result.totalPages) {
    const next = new URLSearchParams({ page: String(result.totalPages), pageSize: String(result.pageSize) });
    if (params.query) next.set("query", params.query);
    if (params.status) next.set("status", params.status);
    if (params.sort) next.set("sort", params.sort);
    if (params.dir) next.set("dir", params.dir);
    redirect(`/admin/pages?${next}`);
  }
  const status = ["draft", "review", "scheduled", "published", "archived"].includes(params.status ?? "") ? params.status as "draft" | "review" | "scheduled" | "published" | "archived" : "all";
  return <main className="admin-page"><PagesManager initialQuery={params.query ?? ""} initialStatus={status} key={params.query ?? ""} result={result} /></main>;
}
