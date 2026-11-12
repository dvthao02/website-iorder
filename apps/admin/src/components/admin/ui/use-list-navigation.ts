"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AdminTableSort } from "./admin-data-table";

/** Bộ lọc, sắp xếp và trang của danh sách nằm trên URL để tải lại/chia sẻ link vẫn giữ nguyên. */
export function useListNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sortKey = searchParams.get("sort");
  const sortDir = searchParams.get("dir");
  const sort: AdminTableSort = sortKey ? { key: sortKey, dir: sortDir === "asc" ? "asc" : "desc" } : null;

  function navigate(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`);
  }

  // Đổi sắp xếp hoặc bộ lọc thì về trang 1.
  function setSort(next: AdminTableSort) {
    navigate({ page: undefined, sort: next?.key, dir: next?.dir });
  }

  function setFilter(key: string, value: string | undefined) {
    navigate({ page: undefined, [key]: value });
  }

  // Chân trang chung (AdminPagination): trang 1 bỏ khỏi URL cho gọn; đổi số dòng/trang thì về trang 1.
  const pagination = {
    onChange: (page: number) => navigate({ page: page === 1 ? undefined : String(page) }),
    onPageSizeChange: (pageSize: number) => navigate({ page: undefined, pageSize: String(pageSize) }),
  };

  return { navigate, pagination, searchParams, setFilter, setSort, sort };
}
