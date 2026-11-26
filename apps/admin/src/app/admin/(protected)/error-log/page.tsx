import { redirect } from "next/navigation";

import { isSuperAdmin } from "@iorder/shared/server/auth/permissions";
import { errorLogListQuerySchema } from "@iorder/shared/server/error-log/error-log.contract";
import { ErrorLogClearButton, ErrorLogFilters, ErrorLogPagination, ErrorLogTable } from "@/components/admin/error-log-view";
import { AdminCard } from "@/components/admin/ui/admin-card";
import { AdminListHeader } from "@/components/admin/ui/admin-list-header";
import { AdminListPage } from "@/components/admin/ui/admin-list-page";
import { AdminPage } from "@/components/admin/ui/admin-page";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getErrorLogsPage } from "@/lib/backend";

export const dynamic = "force-dynamic";

const filterKeys = ["query", "sort", "dir"] as const;

export default async function ErrorLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const administrator = await requireAdminPermission("system.view");
  // Xóa nhật ký lỗi chỉ Super Admin (xem apps/api/src/lib/admin-permission.ts: module system chỉ có quyền xem).
  const canManage = isSuperAdmin(administrator);
  const params = await searchParams;
  const query = errorLogListQuerySchema.parse({ page: params.page, pageSize: params.pageSize, ...Object.fromEntries(filterKeys.map((key) => [key, params[key]])) });
  const result = await getErrorLogsPage(query);
  if (query.page > result.totalPages) {
    const next = new URLSearchParams({ page: String(result.totalPages), pageSize: String(query.pageSize) });
    for (const key of filterKeys) { const value = query[key]; if (value) next.set(key, String(value)); }
    redirect(`/admin/error-log?${next}`);
  }

  return <AdminPage variant="flush">
    <AdminListPage>
      <AdminCard>
        <AdminListHeader actions={canManage ? <ErrorLogClearButton total={result.total} /> : undefined} description={`${result.total} lỗi${query.query ? " khớp từ khóa" : ""}`} title="Nhật ký lỗi" />
        <ErrorLogFilters initialQuery={query.query} key={query.query} />
        <ErrorLogTable canManage={canManage} emptyMessage={query.query ? "Không có lỗi khớp từ khóa. Thử từ khóa khác." : "Chưa ghi nhận lỗi nào. Khi máy chủ gặp lỗi nặng, chi tiết kỹ thuật sẽ hiện ở đây."} items={result.items} />
        <ErrorLogPagination page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} />
      </AdminCard>
    </AdminListPage>
  </AdminPage>;
}
