import { requireAdminPermission } from "@/lib/admin-guard";
import { LeadsManager } from "@/components/admin/leads-manager";
import { getLeadsPage } from "@/lib/backend";
import { leadListQuerySchema } from "@iorder/core/server/leads/leads.contract";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadsAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPermission("leads.view");
  const params = await searchParams;
  const query = leadListQuerySchema.parse({ page: params.page, pageSize: params.pageSize, query: params.query, status: params.status, from: params.from, to: params.to, sort: params.sort, dir: params.dir });
  const result = await getLeadsPage(query);
  if (query.page > result.totalPages) {
    const valid = new URLSearchParams(Object.entries({ ...query, page: result.totalPages }).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
    redirect(`/admin/khach-hang-tiem-nang?${valid}`);
  }
  return <main className="admin-page">
    <LeadsManager key={JSON.stringify(query)} initialPage={result} initialQuery={query} />
  </main>;
}
