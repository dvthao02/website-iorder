"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export function AdminSidePanel({ children, footer, isOpen, onClose }: {
  children: ReactNode;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return <div className="admin-side-panel-backdrop" onMouseDown={onClose} role="presentation">
    <aside aria-modal="true" className="admin-side-panel" onMouseDown={(event) => event.stopPropagation()} role="dialog">
      <button aria-label="Đóng trình biên tập" className="admin-side-panel__close" onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
      <div className="admin-side-panel__content">{children}</div>
      {footer ? <footer className="admin-side-panel__footer">{footer}</footer> : null}
    </aside>
  </div>;
}
