"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState } from "react";

import { AdminButton } from "./admin-button";
import { pageSizeOptions } from "./page-size-options";
import { paginationItems, parseJumpPage } from "./pagination-model";

type AdminPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Có thì hiện ô chọn "Hiển thị … dòng/trang"; màn gọi tự về trang 1 khi đổi (đổi số dòng làm số trang thay đổi). */
  onPageSizeChange?: (pageSize: number) => void;
  /** Đơn vị đếm sau số tổng ("bài viết", "tệp"…); mặc định "mục". */
  unit?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
};

// Chân trang dùng chung cho mọi danh sách: Tổng N mục · Hiển thị [25] dòng/trang · ‹ 1 2 3 … 12 › · Đến trang [ ] Đi. Dính đáy vùng cuộn (CSS) để người dùng luôn thấy.
// Danh sách rỗng có totalPages 0 nên mọi phép so với trang cuối đều dùng bản đã kẹp (>= 1).
export function AdminPagination({ page, pageSize, total, totalPages, onChange, onPageSizeChange, unit = "mục", disabled = false, label = "Phân trang", className = "" }: AdminPaginationProps) {
  const pages = Math.max(totalPages, 1);
  const [jump, setJump] = useState("");
  const target = parseJumpPage(jump, pages);

  function go(next: number) {
    if (next >= 1 && next <= pages && next !== page) onChange(next);
  }
  function submitJump() {
    setJump("");
    if (target !== null) go(target);
  }

  return (
    <nav aria-label={label} className={`admin-pagination ${className}`.trim()}>
      <div className="admin-pagination__summary">
        <span>Tổng <strong>{total}</strong> {unit}</span>
        {onPageSizeChange ? (
          <label className="admin-pagination__size">Hiển thị
            <select className="admin-pagination__select" disabled={disabled} onChange={(event) => onPageSizeChange(Number(event.target.value))} value={pageSize}>
              {pageSizeOptions(pageSize).map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            dòng/trang
          </label>
        ) : null}
      </div>
      <div className="admin-pagination__pages">
        <AdminButton aria-label="Trang trước" disabled={disabled || page <= 1} onClick={() => go(page - 1)} size="sm" variant="secondary"><ChevronLeft aria-hidden="true" size={16} /></AdminButton>
        {paginationItems(page, pages).map((item) => typeof item === "number"
          ? <AdminButton aria-current={item === page ? "page" : undefined} aria-label={`Trang ${item}`} disabled={disabled} key={item} onClick={() => go(item)} size="sm" variant={item === page ? "primary" : "secondary"}>{item}</AdminButton>
          : <span aria-hidden="true" className="admin-pagination__gap" key={item}>…</span>)}
        <AdminButton aria-label="Trang sau" disabled={disabled || page >= pages} onClick={() => go(page + 1)} size="sm" variant="secondary"><ChevronRight aria-hidden="true" size={16} /></AdminButton>
      </div>
      {pages > 1 ? (
        <div className="admin-pagination__jump">
          <label>Đến trang
            <input aria-label={`Đến trang (1 đến ${pages})`} className="admin-pagination__input" disabled={disabled} inputMode="numeric" onChange={(event) => setJump(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitJump(); } }} placeholder={`1–${pages}`} type="text" value={jump} />
          </label>
          <AdminButton disabled={disabled || target === null} onClick={submitJump} size="sm" variant="secondary">Đi</AdminButton>
        </div>
      ) : null}
    </nav>
  );
}
