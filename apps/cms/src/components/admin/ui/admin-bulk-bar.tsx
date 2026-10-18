"use client";

import type { ReactNode } from "react";

import { AdminButton } from "./admin-button";

/** Thanh hiện khi đang chọn dòng trong bảng: số đã chọn, các thao tác hàng loạt và nút bỏ chọn. */
export function AdminBulkBar({ count, children, onClear }: { count: number; children: ReactNode; onClear: () => void }) {
  if (count === 0) return null;
  return <div aria-live="polite" className="admin-bulk-bar" role="region" aria-label="Thao tác với các dòng đã chọn">
    <strong>Đã chọn {count}</strong>
    <div className="admin-bulk-bar__actions">{children}</div>
    <AdminButton className="admin-bulk-bar__clear" onClick={onClear} size="sm" variant="ghost">Bỏ chọn</AdminButton>
  </div>;
}
