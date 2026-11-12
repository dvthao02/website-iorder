"use client";

import { X } from "lucide-react";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAdminFocusTrap } from "./admin-focus-trap";

const noSubscribe = () => () => undefined;
// Khung vẽ ra cuối .admin-shell (vẫn nhận kiểu chung của CMS) thay vì tại chỗ gọi: đặt trong vùng có lớp xếp chồng riêng
// (ví dụ thanh tiêu đề sticky z-index 20) thì z-index của khung không vượt được thanh trên cùng và phần đầu khung bị che.
// Chờ host phía client rồi mới dựng form một lần trong portal, tránh mất nội dung nhập khi chuyển cây DOM sau hydration.
const shellHost = () => document.querySelector(".admin-shell") ?? document.body;
const noHost = () => null;

export function AdminSidePanel({ children, footer, isOpen, onClose, label = "Trình biên tập nội dung" }: {
  children: ReactNode;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  label?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const host = useSyncExternalStore(noSubscribe, shellHost, noHost);
  useAdminFocusTrap({ containerRef: panelRef, isOpen: isOpen && Boolean(host), onClose });

  if (!isOpen || !host) return null;

  const panel = <div className="admin-side-panel-backdrop" onMouseDown={onClose} role="presentation">
    <aside aria-label={label} aria-modal="true" className="admin-side-panel" onMouseDown={(event) => event.stopPropagation()} ref={panelRef} role="dialog" tabIndex={-1}>
      <button aria-label="Đóng trình biên tập" className="admin-side-panel__close" onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
      <div className="admin-side-panel__content">{children}</div>
      {footer ? <footer className="admin-side-panel__footer">{footer}</footer> : null}
    </aside>
  </div>;
  return createPortal(panel, host);
}
