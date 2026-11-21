"use client";

import { Pencil, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { AdminHelpTip } from "./admin-help-tip";
import { useNavigationGuard } from "./use-navigation-guard";

const editPathEvent = "admin:edit-path";

/** Trình soạn có ô sửa đường dẫn đăng ký ở đây để nút bút trên thanh tiêu đề mở được ô đó. */
export function useEditPathRequest(onRequest: () => void) {
  const latest = useRef(onRequest);
  useEffect(() => { latest.current = onRequest; });
  useEffect(() => {
    const handle = () => latest.current();
    window.addEventListener(editPathEvent, handle);
    return () => window.removeEventListener(editPathEvent, handle);
  }, []);
}

type AdminDetailPanelProps = {
  actions?: ReactNode;
  backHref: string;
  /** Bật nút bút cạnh địa chỉ để sửa đường dẫn trang (trang có địa chỉ cố định thì không bật). */
  canEditPath?: boolean;
  children: ReactNode;
  /** Thông tin thật của bản ghi hiện ngay cạnh tiêu đề (ví dụ địa chỉ trên website); lời giải thích chung dùng `help`. */
  description?: string;
  eyebrow: string;
  /** Lời giới thiệu màn soạn thảo: chỉ hiện ở biểu tượng ⓘ cạnh tiêu đề, mở khi rê chuột/focus. */
  help?: string;
  hasUnsavedChanges?: boolean;
  notice?: ReactNode;
  title: string;
};

export function AdminDetailPanel({ actions, backHref, canEditPath = false, children, description, eyebrow, hasUnsavedChanges = false, help, notice, title }: AdminDetailPanelProps) {
  useNavigationGuard(hasUnsavedChanges);
  // Tên trang trùng nhãn phía trước (ví dụ "Trang chủ / Trang chủ") thì bỏ nhãn cho khỏi lặp.
  const showEyebrow = eyebrow.trim().toLocaleLowerCase("vi") !== title.trim().toLocaleLowerCase("vi");

  return <section className="admin-detail-panel">
    <header className="admin-detail-panel__header admin-panel-header">
      <div className="admin-detail-panel__heading">{showEyebrow ? <p>{eyebrow}</p> : null}<h1 title={title}>{title}</h1>{help ? <AdminHelpTip label="Giới thiệu màn này">{help}</AdminHelpTip> : null}{description ? <small>{description}</small> : null}{canEditPath ? <button aria-label="Sửa đường dẫn trang" className="admin-detail-panel__edit-path" onClick={() => window.dispatchEvent(new Event(editPathEvent))} title="Sửa đường dẫn trang" type="button"><Pencil aria-hidden="true" size={14} /></button> : null}</div>
      <div className="admin-detail-panel__header-actions">{actions}<Link aria-label="Đóng và quay lại danh sách" className="admin-detail-panel__close" href={backHref} title="Đóng và quay lại danh sách"><X aria-hidden="true" size={18} /></Link></div>
    </header>
    <div className="admin-detail-panel__body"><div className="admin-detail-panel__content">{notice}{children}</div></div>
  </section>;
}
