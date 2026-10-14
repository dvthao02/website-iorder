import { AuditLogTable } from "@/components/admin/audit-log-table";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { getAuditLogsPage } from "@/lib/backend";
import { auditListQuerySchema } from "@iorder/core/server/audit/audit.contract";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminInput } from "@/components/admin/ui/admin-input";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { redirect } from "next/navigation";
import { auditEntityLabels } from "@/components/admin/ui/audit-labels";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = auditListQuerySchema.parse({ page: params.page, pageSize: params.pageSize, query: params.query, entityType: params.entityType });
  const result = await getAuditLogsPage(query);
  const pageHref = (page: number) => `/admin/nhat-ky?${new URLSearchParams({ page: String(page), pageSize: String(query.pageSize), query: query.query, entityType: query.entityType })}`;
  if (query.page > result.totalPages) redirect(pageHref(result.totalPages));

  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <AdminCard className="p-4">
      <AdminListHeader title="Nhật ký thao tác" description="Tra cứu lịch sử theo người thực hiện, thao tác hoặc loại đối tượng." />
      <form action="/admin/nhat-ky" method="get" className="my-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1">Từ khóa<AdminInput name="query" maxLength={160} defaultValue={query.query} placeholder="Thao tác hoặc người thực hiện" /></label>
        <label className="grid gap-1">Loại đối tượng<AdminInput list="audit-entity-types" name="entityType" maxLength={100} defaultValue={query.entityType} placeholder="Chọn loại đối tượng" /></label>
        <datalist id="audit-entity-types">{Object.entries(auditEntityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</datalist>
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <AdminButton type="submit">Tìm kiếm</AdminButton>
        <AdminButton href="/admin/nhat-ky" variant="secondary">Xóa bộ lọc</AdminButton>
      </form>
      <AuditLogTable entries={result.items} emptyMessage={query.query || query.entityType ? "Không có thao tác khớp bộ lọc. Thử đổi từ khóa hoặc loại đối tượng." : undefined} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p>{result.total} thao tác · Trang {result.page}/{result.totalPages}</p>
        <div className="flex gap-2">
          {result.page > 1 ? <AdminButton href={pageHref(result.page - 1)} variant="secondary">Trang trước</AdminButton> : <AdminButton disabled variant="secondary">Trang trước</AdminButton>}
          {result.page < result.totalPages ? <AdminButton href={pageHref(result.page + 1)} variant="secondary">Trang sau</AdminButton> : <AdminButton disabled variant="secondary">Trang sau</AdminButton>}
        </div>
      </div>
    </AdminCard>
  </main>;
}
