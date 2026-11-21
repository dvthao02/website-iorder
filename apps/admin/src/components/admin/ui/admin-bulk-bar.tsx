"use client";

import { createContext, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { AdminButton } from "./admin-button";

/** Số dòng đang chọn, để menu "Thao tác" biết khi chưa chọn dòng nào. */
export const AdminBulkCountContext = createContext<number | null>(null);

const noSubscribe = () => () => undefined;
// Mỗi màn danh sách chỉ có một thanh lọc; màn không có (ví dụ Chuyên mục & Thẻ) thì thanh hiện riêng phía trên bảng khi đang chọn.
const filterBarSlot = () => document.querySelector<HTMLElement>(".admin-filter-bar__bulk-actions");
const noSlot = () => null;

/**
 * Thao tác hàng loạt nằm cùng dòng ô tìm kiếm và luôn hiện (cao bằng các nút lọc); khi đã chọn dòng thì thêm
 * "Đã chọn n" và "Bỏ chọn".
 */
export function AdminBulkBar({ count, children, onClear }: { count: number; children: ReactNode; onClear: () => void }) {
  const slot = useSyncExternalStore(noSubscribe, filterBarSlot, noSlot);
  if (!slot && count === 0) return null;
  const bar = <div aria-live="polite" className={slot ? "admin-bulk-bar admin-bulk-bar--inline" : "admin-bulk-bar"} role="region" aria-label="Thao tác với các dòng đã chọn">
    {count ? <strong>Đã chọn {count}</strong> : null}
    <div className="admin-bulk-bar__actions"><AdminBulkCountContext.Provider value={count}>{children}</AdminBulkCountContext.Provider></div>
    {count ? <AdminButton className="admin-bulk-bar__clear" onClick={onClear} variant="ghost">Bỏ chọn</AdminButton> : null}
  </div>;
  return slot ? createPortal(bar, slot) : bar;
}
