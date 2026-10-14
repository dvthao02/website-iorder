import { LeadsManager } from "@/components/admin/leads-manager";
import { getLeadsPage } from "@/lib/backend";
import { leadListQuerySchema } from "@iorder/core/server/leads/leads.contract";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadsAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = leadListQuerySchema.parse({ page: params.page, pageSize: params.pageSize, query: params.query, status: params.status });
  const result = await getLeadsPage(query);
  if (query.page > result.totalPages) {
    const valid = new URLSearchParams({ status: query.status, query: query.query, pageSize: String(query.pageSize), page: String(result.totalPages) });
    redirect(`/admin/khach-hang-tiem-nang?${valid}`);
  }
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <LeadsManager key={JSON.stringify(query)} initialPage={result} initialQuery={query} />
  </main>;
}
