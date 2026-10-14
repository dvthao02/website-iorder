"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function AdminSidePanel({ children, footer, isOpen, onClose, label = "Trình biên tập nội dung" }: {
  children: ReactNode;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  label?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const panel = panelRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableElements = () => Array.from(panel.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"))
      .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled, [aria-disabled='true']") && element.getClientRects().length > 0);

    (focusableElements()[0] ?? panel).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === "Tab") {
        const elements = focusableElements();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first || !last) {
          event.preventDefault();
          panel.focus();
        } else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return <div className="admin-side-panel-backdrop" onMouseDown={onClose} role="presentation">
    <aside aria-label={label} aria-modal="true" className="admin-side-panel" onMouseDown={(event) => event.stopPropagation()} ref={panelRef} role="dialog" tabIndex={-1}>
      <button aria-label="Đóng trình biên tập" className="admin-side-panel__close" onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
      <div className="admin-side-panel__content">{children}</div>
      {footer ? <footer className="admin-side-panel__footer">{footer}</footer> : null}
    </aside>
  </div>;
}
