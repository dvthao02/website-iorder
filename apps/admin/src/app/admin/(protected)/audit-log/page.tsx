import { requireAdminPermission } from "@/lib/admin-guard";
import { AuditLogFilters } from "@/components/admin/audit-log-filters";
import { AuditLogPagination } from "@/components/admin/audit-log-pagination";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { getAuditLogsPage } from "@/lib/backend";
import { auditListQuerySchema } from "@iorder/shared/server/audit/audit.contract";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const filterKeys = ["query", "entityType", "userId", "verb", "from", "to", "sort", "dir"] as const;

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPermission("audit.view");
  const params = await searchParams;
  const query = auditListQuerySchema.parse({ page: params.page, pageSize: params.pageSize, ...Object.fromEntries(filterKeys.map((key) => [key, params[key]])) });
  const result = await getAuditLogsPage(query);
  const pageHref = (page: number) => {
    const next = new URLSearchParams({ page: String(page), pageSize: String(query.pageSize) });
    for (const key of filterKeys) { const value = query[key]; if (value) next.set(key, String(value)); }
    return `/admin/audit-log?${next}`;
  };
  if (query.page > result.totalPages) redirect(pageHref(result.totalPages));

  const filtered = Boolean(query.query || query.entityType || query.userId || query.verb || query.from || query.to);
  return <main className="admin-page">
    <AdminListPage>
      <AdminCard>
        <AdminListHeader title="Nhật ký hoạt động" description={`${result.total} thao tác${filtered ? " khớp bộ lọc" : ""}`} />
        <AuditLogFilters actors={result.actors} initial={{ query: query.query, entityType: query.entityType, userId: query.userId, verb: query.verb, from: query.from, to: query.to }} key={query.query} />
        <AuditLogTable entries={result.items} emptyMessage={filtered ? "Không có thao tác khớp bộ lọc. Thử đổi từ khóa, người thực hiện hoặc khoảng ngày." : undefined} />
        <AuditLogPagination page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} />
      </AdminCard>
    </AdminListPage>
  </main>;
}
