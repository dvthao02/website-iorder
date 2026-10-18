import { requireAdminPermission } from "@/lib/admin-guard";
import { AuditLogFilters } from "@/components/admin/audit-log-filters";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { getAuditLogsPage } from "@/lib/backend";
import { auditListQuerySchema } from "@iorder/core/server/audit/audit.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
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
    return `/admin/nhat-ky?${next}`;
  };
  if (query.page > result.totalPages) redirect(pageHref(result.totalPages));

  const filtered = Boolean(query.query || query.entityType || query.userId || query.verb || query.from || query.to);
  return <main className="admin-page">
    <AdminListPage>
      <AdminCard>
        <AdminListHeader title="Nhật ký hoạt động" description={`${result.total} thao tác${filtered ? " khớp bộ lọc" : ""}`} />
        <AuditLogFilters actors={result.actors} initial={{ query: query.query, entityType: query.entityType, userId: query.userId, verb: query.verb, from: query.from, to: query.to }} key={query.query} />
        <AuditLogTable entries={result.items} emptyMessage={filtered ? "Không có thao tác khớp bộ lọc. Thử đổi từ khóa, người thực hiện hoặc khoảng ngày." : undefined} />
        <nav aria-label="Phân trang nhật ký" className="admin-pagination">
          <span>Trang {result.page}/{Math.max(result.totalPages, 1)}</span>
          <div>
            {result.page > 1 ? <AdminButton href={pageHref(result.page - 1)} size="sm" variant="secondary">Trang trước</AdminButton> : <AdminButton disabled size="sm" variant="secondary">Trang trước</AdminButton>}
            {result.page < result.totalPages ? <AdminButton href={pageHref(result.page + 1)} size="sm" variant="secondary">Trang sau</AdminButton> : <AdminButton disabled size="sm" variant="secondary">Trang sau</AdminButton>}
          </div>
        </nav>
      </AdminCard>
    </AdminListPage>
  </main>;
}
