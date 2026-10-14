import React from "react";

import { AdminButton } from "./admin-button";

type AdminPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

// Shared list footer: one wording, one disabled rule (an empty list has
// totalPages 0, so "next" must use >= rather than ===).
export function AdminPagination({ page, pageSize, total, totalPages, onChange, disabled = false, label = "Phân trang", className = "" }: AdminPaginationProps) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label={label} className={`admin-pagination flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--cms-muted)] ${className}`.trim()}>
      <span>Hiển thị {first}–{last} trên {total} mục</span>
      <div className="flex items-center gap-2">
        <AdminButton disabled={disabled || page <= 1} onClick={() => onChange(page - 1)} variant="secondary">Trang trước</AdminButton>
        <span className="min-w-16 text-center font-semibold">{page}/{Math.max(totalPages, 1)}</span>
        <AdminButton disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)} variant="secondary">Trang sau</AdminButton>
      </div>
    </nav>
  );
}
