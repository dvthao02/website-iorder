import { requireAdminPermission } from "@/lib/admin-guard";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { getAuditLogsPage } from "@/lib/backend";
import { auditListQuerySchema } from "@iorder/core/server/audit/audit.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminFilterBar } from "@/components/admin/ui/admin-filter-bar";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { AdminSearchField } from "@/components/admin/ui/admin-search-field";
import { redirect } from "next/navigation";
import { auditEntityLabels } from "@/components/admin/ui/audit-labels";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPermission("audit.view");
  const params = await searchParams;
  const query = auditListQuerySchema.parse({ page: params.page, pageSize: params.pageSize, query: params.query, entityType: params.entityType });
  const result = await getAuditLogsPage(query);
  const pageHref = (page: number) => `/admin/nhat-ky?${new URLSearchParams({ page: String(page), pageSize: String(query.pageSize), query: query.query, entityType: query.entityType })}`;
  if (query.page > result.totalPages) redirect(pageHref(result.totalPages));

  const filtered = Boolean(query.query || query.entityType);
  return <main className="admin-page">
    <AdminListPage>
      <AdminCard>
        <AdminListHeader title="Nhật ký hoạt động" description={`${result.total} thao tác${filtered ? " khớp bộ lọc" : ""}`} />
        <AdminFilterBar action="/admin/nhat-ky" method="get" actions={filtered ? <AdminButton href="/admin/nhat-ky" size="sm" variant="ghost">Xóa bộ lọc</AdminButton> : undefined}>
          <AdminSearchField defaultValue={query.query} label="Tìm thao tác hoặc người thực hiện" maxLength={160} name="query" placeholder="Thao tác hoặc người thực hiện" />
          <input aria-label="Loại đối tượng" defaultValue={query.entityType} list="audit-entity-types" maxLength={100} name="entityType" placeholder="Tất cả loại đối tượng" />
          <datalist id="audit-entity-types">{Object.entries(auditEntityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</datalist>
          <input type="hidden" name="pageSize" value={query.pageSize} />
        </AdminFilterBar>
        <AuditLogTable entries={result.items} emptyMessage={filtered ? "Không có thao tác khớp bộ lọc. Thử đổi từ khóa hoặc loại đối tượng." : undefined} />
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
