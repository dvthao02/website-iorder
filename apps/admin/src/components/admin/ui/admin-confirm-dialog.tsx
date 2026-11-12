"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AdminButton } from "./admin-button";
import { useAdminFocusTrap } from "./admin-focus-trap";
import { registerLeaveConfirm } from "./use-navigation-guard";

export type AdminConfirmOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  title: string;
  tone?: "danger" | "default";
};

export type ResolvedAdminConfirmOptions = Required<AdminConfirmOptions>;

export function resolveAdminConfirmOptions(options: AdminConfirmOptions): ResolvedAdminConfirmOptions {
  return { cancelLabel: "Hủy", confirmLabel: "Xác nhận", tone: "default", ...options };
}

type AdminConfirmContextValue = { confirm: (options: AdminConfirmOptions) => Promise<boolean> };
const AdminConfirmContext = createContext<AdminConfirmContextValue | undefined>(undefined);

export function AdminConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ResolvedAdminConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const close = useCallback((confirmed: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOptions(null);
    resolve?.(confirmed);
  }, []);
  const confirm = useCallback((nextOptions: AdminConfirmOptions) => new Promise<boolean>((resolve) => {
    if (resolveRef.current) {
      resolve(false);
      return;
    }
    resolveRef.current = resolve;
    setOptions(resolveAdminConfirmOptions(nextOptions));
  }), []);
  const value = useMemo(() => ({ confirm }), [confirm]);
  // Hộp "rời trang khi chưa lưu" dùng chung hộp xác nhận này thay cho window.confirm của trình duyệt.
  useEffect(() => {
    registerLeaveConfirm(confirm);
    return () => registerLeaveConfirm(undefined);
  }, [confirm]);

  useEffect(() => () => {
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return <AdminConfirmContext.Provider value={value}>{children}{options ? <AdminConfirmDialog onClose={close} options={options} /> : null}</AdminConfirmContext.Provider>;
}

function AdminConfirmDialog({ onClose, options }: { onClose: (confirmed: boolean) => void; options: ResolvedAdminConfirmOptions }) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = "admin-confirm-dialog-title";
  const descriptionId = "admin-confirm-dialog-description";
  useAdminFocusTrap({ containerRef: dialogRef, initialFocusSelector: "[data-admin-confirm-cancel]", isOpen: true, onClose: () => onClose(false) });

  return <div className="admin-confirm-dialog-backdrop" onMouseDown={() => onClose(false)} role="presentation">
    <section aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal="true" className="admin-confirm-dialog" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="alertdialog" tabIndex={-1}>
      <h2 id={titleId}>{options.title}</h2>
      <p id={descriptionId}>{options.message}</p>
      <div className="admin-confirm-dialog__actions">
        <AdminButton data-admin-confirm-cancel onClick={() => onClose(false)} variant="secondary">{options.cancelLabel}</AdminButton>
        <AdminButton onClick={() => onClose(true)} variant={options.tone === "danger" ? "danger" : "primary"}>{options.confirmLabel}</AdminButton>
      </div>
    </section>
  </div>;
}

export function useAdminConfirm() {
  const context = useContext(AdminConfirmContext);
  if (!context) throw new Error("useAdminConfirm phải được dùng bên trong AdminConfirmProvider.");
  return context;
}
