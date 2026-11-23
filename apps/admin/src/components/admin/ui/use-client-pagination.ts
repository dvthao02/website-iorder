"use client";

import { useState } from "react";

/** Cắt một trang từ danh sách đã nạp đủ trong trình duyệt; trang vượt giới hạn được kẹp về trang hợp lệ gần nhất. */
export function paginateRows<T>(rows: readonly T[], page: number, pageSize: number) {
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 25;
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Number.isInteger(page) ? page : 1), totalPages);
  return { rows: rows.slice((current - 1) * size, current * size), page: current, pageSize: size, total, totalPages };
}

/**
 * Phân trang trong trình duyệt cho danh sách nhỏ chưa có phân trang phía máy chủ (chuyển hướng, tệp cài đặt, tác giả, chuyên mục/thẻ):
 * cùng chân trang AdminPagination như các danh sách khác. resetKey đổi (từ khóa, bộ lọc…) thì về trang 1; xóa bớt mục làm trang cuối
 * trống thì tự lùi một trang. Truyền `pagination` thẳng vào <AdminPagination {...pagination} />.
 */
export function useClientPagination<T>(rows: readonly T[], resetKey: string, defaultPageSize = 25) {
  const [state, setState] = useState({ key: resetKey, page: 1, pageSize: defaultPageSize });
  const view = paginateRows(rows, state.key === resetKey ? state.page : 1, state.pageSize);
  return {
    rows: view.rows,
    pagination: {
      page: view.page,
      pageSize: view.pageSize,
      total: view.total,
      totalPages: view.totalPages,
      onChange: (page: number) => setState({ key: resetKey, page, pageSize: view.pageSize }),
      onPageSizeChange: (pageSize: number) => setState({ key: resetKey, page: 1, pageSize }),
    },
  };
}
