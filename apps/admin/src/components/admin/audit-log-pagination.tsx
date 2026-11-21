"use client";

import { AdminPagination } from "./ui/admin-pagination";
import { useListNavigation } from "./ui/use-list-navigation";

/** Chân trang của Nhật ký hoạt động: trang và số dòng/trang nằm trên URL, các bộ lọc khác giữ nguyên. */
export function AuditLogPagination({ page, pageSize, total, totalPages }: { page: number; pageSize: number; total: number; totalPages: number }) {
  const { pagination } = useListNavigation();
  return <AdminPagination unit="thao tác" label="Phân trang nhật ký" page={page} pageSize={pageSize} total={total} totalPages={totalPages} {...pagination} />;
}
