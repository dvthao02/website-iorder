"use client";

import { ChevronDown, ListChecks } from "lucide-react";
import { useContext, useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";

import { AdminBulkCountContext } from "./admin-bulk-bar";

export type AdminBulkMenuAction = {
  key: string;
  label: string;
  icon: ReactNode;
  /** Số dòng đã chọn áp dụng được thao tác này (hiện trong ngoặc); 0 thì mục mờ đi. */
  count: number;
  /** Lý do không dùng được (thiếu quyền, chỉ áp dụng cho mục đã lưu trữ…): mục mờ, lý do hiện khi rê chuột. */
  disabledReason?: string;
  tone?: "danger";
  onSelect?: () => void;
  /** Tải file (xuất Excel) thay cho onSelect. */
  href?: string;
};

// Thanh chọn nhiều dòng: mọi thao tác hàng loạt gom trong một menu "Thao tác ▾" (như bulk actions của WordPress/Shopify).
// Thao tác không áp dụng được cho các dòng đang chọn vẫn hiện nhưng mờ (lý do ở tooltip), để người dùng biết vì sao.
// Là <details class="admin-popover">: tự đóng khi bấm ra ngoài/Esc nhờ usePopoverDismiss trong khung CMS.
// Danh sách đặt cố định theo vị trí nút (thoát khỏi thẻ/bảng có overflow ẩn, không bị cắt khi bảng ít dòng); cuộn trang thì đóng.
export function AdminBulkMenu({ actions, busy }: { actions: AdminBulkMenuAction[]; busy: boolean }) {
  const [position, setPosition] = useState<CSSProperties | null>(null);
  // Chưa chọn dòng nào: nút vẫn hiện (kiểu thường), mục trong menu mờ.
  const nothingSelected = useContext(AdminBulkCountContext) === 0;
  const close = (event: MouseEvent<HTMLElement>) => event.currentTarget.closest("details")?.removeAttribute("open");
  function place(event: SyntheticEvent<HTMLDetailsElement>) {
    const menu = event.currentTarget;
    const anchor = menu.querySelector("summary")?.getBoundingClientRect();
    if (!menu.open || !anchor) { setPosition(null); return; }
    const width = Math.min(260, window.innerWidth - 24);
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
    <summary aria-label="Chọn thao tác cho các dòng đã chọn"><span className={nothingSelected ? "admin-button admin-button--secondary" : "admin-button admin-button--primary"}><ListChecks aria-hidden="true" size={15} />{busy ? "Đang xử lý…" : "Thao tác"}<ChevronDown aria-hidden="true" size={14} /></span></summary>
    <div className="admin-header-popover admin-bulk-menu__list" role="menu" style={position ?? undefined}>
      {actions.map((action) => {
        const reason = nothingSelected ? "Chọn dòng trong bảng trước" : action.disabledReason ?? (action.count === 0 ? "Không có dòng phù hợp" : undefined);
        const disabled = busy || Boolean(reason);
        const className = `admin-bulk-menu__item${action.tone === "danger" ? " admin-bulk-menu__item--danger" : ""}`;
        const content = <>
          <span className="admin-bulk-menu__icon">{action.icon}</span>
          <span>{action.label}{action.count ? ` (${action.count})` : ""}</span>
        </>;
        return action.href && !disabled
          ? <a className={className} download href={action.href} key={action.key} onClick={close} role="menuitem">{content}</a>
          : <button aria-disabled={disabled || undefined} className={className} disabled={disabled} key={action.key} title={reason} onClick={(event) => { close(event); action.onSelect?.(); }} role="menuitem" type="button">{content}</button>;
      })}
    </div>
  </details>;
}
