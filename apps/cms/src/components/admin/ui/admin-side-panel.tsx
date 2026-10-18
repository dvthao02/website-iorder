"use client";

import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useAdminFocusTrap } from "./admin-focus-trap";

export function AdminSidePanel({ children, footer, isOpen, onClose, label = "Trình biên tập nội dung" }: {
  children: ReactNode;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  label?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useAdminFocusTrap({ containerRef: panelRef, isOpen, onClose });

  if (!isOpen) return null;

  return <div className="admin-side-panel-backdrop" onMouseDown={onClose} role="presentation">
    <aside aria-label={label} aria-modal="true" className="admin-side-panel" onMouseDown={(event) => event.stopPropagation()} ref={panelRef} role="dialog" tabIndex={-1}>
      <button aria-label="Đóng trình biên tập" className="admin-side-panel__close" onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
      <div className="admin-side-panel__content">{children}</div>
      {footer ? <footer className="admin-side-panel__footer">{footer}</footer> : null}
    </aside>
  </div>;
}
