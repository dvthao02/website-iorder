import { AdminPage } from "@/components/admin/ui/admin-page";
import { requireAdminPermission } from "@/lib/admin-guard";
import { LeadsManager } from "@/components/admin/leads-manager";
import { getLeadDetail, getLeadsPage } from "@/lib/backend";
import { leadListQuerySchema } from "@iorder/shared/server/leads/leads.contract";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadsAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPermission("leads.view");
  const params = await searchParams;
  const query = leadListQuerySchema.parse({ page: params.page, pageSize: params.pageSize, query: params.query, status: params.status, source: params.source, assignee: params.assignee, focus: params.focus, from: params.from, to: params.to, sort: params.sort, dir: params.dir });
  const result = await getLeadsPage(query);
  // Mở sẵn khung chi tiết của một liên hệ (từ thông báo), lấy riêng vì liên hệ có thể không nằm ở trang đang xem.
  const openId = typeof params.open === "string" && /^[0-9a-f-]{36}$/i.test(params.open) ? params.open : null;
  const initialOpen = openId ? await getLeadDetail(openId) : null;
  if (query.page > result.totalPages) {
    const valid = new URLSearchParams(Object.entries({ ...query, page: result.totalPages }).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
    redirect(`/admin/leads?${valid}`);
  }
  return <AdminPage variant="flush">
    <LeadsManager key={JSON.stringify({ query, open: initialOpen?.id ?? null })} initialOpen={initialOpen} initialPage={result} initialQuery={query} />
  </AdminPage>;
}
