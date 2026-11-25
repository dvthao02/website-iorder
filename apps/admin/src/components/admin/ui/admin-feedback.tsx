"use client";

import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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

/** `silent`: không đặt role cho trình đọc màn hình (dùng trong thông báo nổi, nơi khung ngoài đã tự báo; đặt hai lần thì bị đọc hai lần). */
export function AdminNotice({ children, tone = "info", silent = false }: { children: ReactNode; tone?: Exclude<AdminFeedbackTone, "neutral">; silent?: boolean }) {
  const Icon = toneIcon[tone];
  return <div className={`admin-notice admin-notice--${tone}`} role={silent ? undefined : tone === "error" ? "alert" : "status"}><Icon aria-hidden="true" size={18} /><span>{children}</span></div>;
}

type Toast = { id: number; message: string; tone: Exclude<AdminFeedbackTone, "neutral"> };
type ToastContextValue = { dismiss: (id: number) => void; show: (message: string, tone?: Toast["tone"]) => void };
const AdminToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Thời gian một thông báo nổi hiện trên màn hình: đủ để đọc hết câu dài (2,5 giây + 45 ms mỗi ký tự), tối thiểu 4 giây
 * (lỗi và cảnh báo 6 giây vì người dùng cần đọc kỹ để xử lý), tối đa 15 giây.
 */
export function toastDurationMs(message: string, tone: Toast["tone"]) {
  const minimum = tone === "error" || tone === "warning" ? 6_000 : 4_000;
  return Math.min(15_000, Math.max(minimum, 2_500 + message.length * 45));
}

// Rời chuột (hoặc rời bàn phím) khỏi thông báo thì còn hiện thêm chừng này rồi mới tự đóng.
const hoverGraceMs = 2_500;
const maxVisibleToasts = 4;

/**
 * Thông báo nổi ở giữa đầu màn hình. Cùng một câu đang hiện thì chỉ làm mới thời gian (không xếp thêm bản sao khi bấm liên tiếp);
 * rê chuột hoặc focus vào thì tạm dừng đếm giờ để kịp đọc hay bấm đóng; tối đa 4 thông báo cùng lúc (cũ nhất bị thay).
 */
export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Nguồn sự thật nằm ở ref để show() liên tiếp trong cùng một nhịp vẫn thấy nhau; state chỉ để vẽ lại.
  const list = useRef<Toast[]>([]);
  const timers = useRef(new Map<number, number>());
  const commit = useCallback((next: Toast[]) => { list.current = next; setToasts(next); }, []);
  const stop = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) { window.clearTimeout(timer); timers.current.delete(id); }
  }, []);
  const dismiss = useCallback((id: number) => { stop(id); commit(list.current.filter((toast) => toast.id !== id)); }, [commit, stop]);
  const schedule = useCallback((id: number, ms: number) => {
    stop(id);
    timers.current.set(id, window.setTimeout(() => dismiss(id), ms));
  }, [dismiss, stop]);
  const show = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const existing = list.current.find((toast) => toast.message === message && toast.tone === tone);
    if (existing) { schedule(existing.id, toastDurationMs(message, tone)); return; }
    const id = Date.now() + Math.round(Math.random() * 1_000);
    const dropped = list.current.slice(0, Math.max(0, list.current.length - (maxVisibleToasts - 1)));
    for (const toast of dropped) stop(toast.id);
    commit([...list.current.slice(-(maxVisibleToasts - 1)), { id, message, tone }]);
    schedule(id, toastDurationMs(message, tone));
  }, [commit, schedule, stop]);
  const value = useMemo(() => ({ dismiss, show }), [dismiss, show]);
  // Rời trang thì hủy mọi bộ đếm giờ còn chạy.
  useEffect(() => { const active = timers.current; return () => { active.forEach((timer) => window.clearTimeout(timer)); active.clear(); }; }, []);

  return <AdminToastContext.Provider value={value}>{children}<div aria-live="polite" className="admin-toast-stack">{toasts.map((toast) => <div
    className={`admin-toast admin-toast--${toast.tone}`} key={toast.id}
    onBlur={() => schedule(toast.id, hoverGraceMs)} onFocus={() => stop(toast.id)}
    onMouseEnter={() => stop(toast.id)} onMouseLeave={() => schedule(toast.id, hoverGraceMs)}
    role={toast.tone === "error" ? "alert" : "status"}
  ><span><AdminNotice silent tone={toast.tone}>{toast.message}</AdminNotice></span><button aria-label="Đóng thông báo" onClick={() => dismiss(toast.id)} type="button"><X aria-hidden="true" size={16} /></button></div>)}</div></AdminToastContext.Provider>;
}

export function useAdminToast() {
  const context = useContext(AdminToastContext);
  if (!context) throw new Error("useAdminToast phải được dùng bên trong AdminToastProvider.");
  return context;
}
