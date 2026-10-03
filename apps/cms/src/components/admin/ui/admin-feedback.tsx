"use client";

import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type AdminFeedbackTone = "success" | "error" | "warning" | "info" | "neutral";

const toneIcon = {
  error: CircleAlert,
  info: Info,
  neutral: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
} satisfies Record<AdminFeedbackTone, typeof Info>;

export function AdminStatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: AdminFeedbackTone }) {
  return <span className={`admin-status-badge admin-status-badge--${tone}`}>{children}</span>;
}

export function AdminNotice({ children, tone = "info" }: { children: ReactNode; tone?: Exclude<AdminFeedbackTone, "neutral"> }) {
  const Icon = toneIcon[tone];
  return <div className={`admin-notice admin-notice--${tone}`} role={tone === "error" ? "alert" : "status"}><Icon aria-hidden="true" size={18} /><span>{children}</span></div>;
}

type Toast = { id: number; message: string; tone: Exclude<AdminFeedbackTone, "neutral"> };
type ToastContextValue = { dismiss: (id: number) => void; show: (message: string, tone?: Toast["tone"]) => void };
const AdminToastContext = createContext<ToastContextValue | undefined>(undefined);

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.round(Math.random() * 1_000);
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), tone === "error" ? 6_000 : 4_000);
  }, [dismiss]);
  const value = useMemo(() => ({ dismiss, show }), [dismiss, show]);

  return <AdminToastContext.Provider value={value}>{children}<div aria-live="polite" className="admin-toast-stack">{toasts.map((toast) => <div className={`admin-toast admin-toast--${toast.tone}`} key={toast.id} role={toast.tone === "error" ? "alert" : "status"}><span><AdminNotice tone={toast.tone}>{toast.message}</AdminNotice></span><button aria-label="Đóng thông báo" onClick={() => dismiss(toast.id)} type="button"><X aria-hidden="true" size={16} /></button></div>)}</div></AdminToastContext.Provider>;
}

export function useAdminToast() {
  const context = useContext(AdminToastContext);
  if (!context) throw new Error("useAdminToast phải được dùng bên trong AdminToastProvider.");
  return context;
}
