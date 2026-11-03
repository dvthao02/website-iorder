"use client";

import { ChevronDown, ListChecks } from "lucide-react";
import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";

export type AdminBulkMenuAction = {
  key: string;
  label: string;
  icon: ReactNode;
  /** Số dòng đã chọn áp dụng được thao tác này (hiện trong ngoặc); 0 thì mục mờ đi. */
  count: number;
  /** Lý do không dùng được (thiếu quyền, không có dòng phù hợp…): mục mờ và hiện lý do bên dưới. */
  disabledReason?: string;
  /** Gợi ý ngắn khi dùng được (ví dụ "Ẩn khỏi website, khôi phục được"). */
  hint?: string;
  tone?: "danger";
  onSelect?: () => void;
  /** Tải file (xuất Excel) thay cho onSelect. */
  href?: string;
};

// Thanh chọn nhiều dòng: mọi thao tác hàng loạt gom trong một menu "Thao tác ▾" (như bulk actions của WordPress/Shopify).
// Thao tác không áp dụng được cho các dòng đang chọn vẫn hiện nhưng mờ kèm lý do, để người dùng biết vì sao.
// Là <details class="admin-popover">: tự đóng khi bấm ra ngoài/Esc nhờ usePopoverDismiss trong khung CMS.
// Danh sách đặt cố định theo vị trí nút (thoát khỏi thẻ/bảng có overflow ẩn, không bị cắt khi bảng ít dòng); cuộn trang thì đóng.
export function AdminBulkMenu({ actions, busy }: { actions: AdminBulkMenuAction[]; busy: boolean }) {
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const close = (event: MouseEvent<HTMLElement>) => event.currentTarget.closest("details")?.removeAttribute("open");
  function place(event: SyntheticEvent<HTMLDetailsElement>) {
    const menu = event.currentTarget;
    const anchor = menu.querySelector("summary")?.getBoundingClientRect();
    if (!menu.open || !anchor) { setPosition(null); return; }
    const width = Math.min(320, window.innerWidth - 24);
    setPosition({ position: "fixed", top: anchor.bottom + 6, left: Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)), right: "auto", width, marginTop: 0 });
  }
  useEffect(() => {
    if (!position) return;
    const closeOnScroll = () => { for (const menu of document.querySelectorAll<HTMLDetailsElement>("details.admin-bulk-menu[open]")) menu.open = false; };
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => { window.removeEventListener("scroll", closeOnScroll, true); window.removeEventListener("resize", closeOnScroll); };
  }, [position]);
  return <details className="admin-popover admin-bulk-menu" onToggle={place}>
    <summary aria-label="Chọn thao tác cho các dòng đã chọn"><span className="admin-button admin-button--primary admin-button--sm"><ListChecks aria-hidden="true" size={15} />{busy ? "Đang xử lý…" : "Thao tác"}<ChevronDown aria-hidden="true" size={14} /></span></summary>
    <div className="admin-header-popover admin-bulk-menu__list" role="menu" style={position ?? undefined}>
      {actions.map((action) => {
        const reason = action.disabledReason ?? (action.count === 0 ? "Không có dòng nào phù hợp trong các dòng đã chọn." : undefined);
        const disabled = busy || Boolean(reason);
        const className = `admin-bulk-menu__item${action.tone === "danger" ? " admin-bulk-menu__item--danger" : ""}`;
        const content = <>
          <span className="admin-bulk-menu__icon">{action.icon}</span>
          <span><strong>{action.label}{action.count ? ` (${action.count})` : ""}</strong>{reason ? <small>{reason}</small> : action.hint ? <small>{action.hint}</small> : null}</span>
        </>;
        return action.href && !disabled
          ? <a className={className} download href={action.href} key={action.key} onClick={close} role="menuitem">{content}</a>
          : <button aria-disabled={disabled || undefined} className={className} disabled={disabled} key={action.key} onClick={(event) => { close(event); action.onSelect?.(); }} role="menuitem" type="button">{content}</button>;
      })}
    </div>
  </details>;
}
