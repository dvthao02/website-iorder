"use client";

import { ListFilter, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormHTMLAttributes, type ReactNode } from "react";

export type AdminFilterChip = { key: string; label: string; onRemove: () => void };

type AdminFilterBarProps = FormHTMLAttributes<HTMLFormElement> & {
  actions?: ReactNode;
  bulkActions?: ReactNode;
  /** Ô tìm kiếm: luôn hiện, kể cả trên điện thoại. */
  search?: ReactNode;
  /** Bộ lọc chính (hiện ngay trên thanh ở màn rộng). */
  children?: ReactNode;
  /** Bộ lọc ít dùng, nằm trong khung "Bộ lọc khác". */
  more?: ReactNode;
  /** Số bộ lọc phụ đang bật, hiện trên nút "Bộ lọc khác". */
  moreActiveCount?: number;
  /** Bộ lọc đang áp dụng, hiện thành nhãn gỡ được ngay dưới thanh. */
  chips?: AdminFilterChip[];
  onClearAll?: () => void;
};

const compactQuery = "(max-width: 680px)";
function subscribeCompact(onChange: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Màn hẹp (điện thoại): gom toàn bộ bộ lọc vào một khung trượt để bảng không bị đẩy xuống. */
export function useCompactViewport() {
  return useSyncExternalStore(subscribeCompact, () => window.matchMedia(compactQuery).matches, () => false);
}

function FilterPanel({ children, label, onClose }: { children: ReactNode; label: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.closest(".admin-filter-bar__more")?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [onClose]);
  return <div aria-label={label} className="admin-filter-bar__panel" ref={ref} role="dialog">
    <header>{label}</header>
    <div className="admin-filter-bar__panel-body">{children}</div>
    <footer><button className="admin-button admin-button--primary admin-button--sm" onClick={onClose} type="button">Xong</button></footer>
  </div>;
}

export function AdminFilterBar({ actions, bulkActions, search, children, more, moreActiveCount = 0, chips = [], onClearAll, className = "", ...props }: AdminFilterBarProps) {
  const compact = useCompactViewport();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // Màn hẹp: mọi bộ lọc (chính + phụ) vào khung; màn rộng: chỉ bộ lọc phụ.
  const panelContent = compact ? <>{children}{more}</> : more;
  const hasPanel = Boolean(compact ? children || more : more);
  const panelCount = compact ? chips.filter((chip) => chip.key !== "query").length : moreActiveCount;
  const buttonLabel = compact ? "Bộ lọc" : "Bộ lọc khác";

  return <form className={`admin-filter-bar ${className}`.trim()} {...props}>
    <div className="admin-filter-bar__controls">
      {search}
      {compact ? null : children}
      {hasPanel ? <div className="admin-filter-bar__more">
        <button aria-controls={panelId} aria-expanded={open} className={panelCount ? "admin-filter-bar__more-button admin-filter-bar__more-button--active" : "admin-filter-bar__more-button"} onClick={() => setOpen((value) => !value)} type="button"><ListFilter aria-hidden="true" size={15} />{buttonLabel}{panelCount ? <b>{panelCount}</b> : null}</button>
        {open ? <div id={panelId}><FilterPanel label={buttonLabel} onClose={() => setOpen(false)}>{panelContent}</FilterPanel></div> : null}
      </div> : null}
    </div>
    {bulkActions ? <div className="admin-filter-bar__bulk-actions">{bulkActions}</div> : null}
    {actions ? <div className="admin-filter-bar__actions">{actions}</div> : null}
    {chips.length ? <div aria-label="Bộ lọc đang áp dụng" className="admin-filter-chips" role="group">
      {chips.map((chip) => <span className="admin-filter-chip" key={chip.key}>{chip.label}<button aria-label={`Bỏ lọc ${chip.label}`} className="admin-filter-chip__remove" onClick={chip.onRemove} type="button"><X aria-hidden="true" size={13} /></button></span>)}
      {onClearAll && chips.length > 1 ? <button className="admin-filter-chips__clear" onClick={onClearAll} type="button">Xóa tất cả</button> : null}
    </div> : null}
  </form>;
}
