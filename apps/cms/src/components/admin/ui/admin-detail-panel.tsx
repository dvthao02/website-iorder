"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type AdminDetailPanelProps = {
  actions?: ReactNode;
  backHref: string;
  children: ReactNode;
  description: string;
  eyebrow: string;
  hasUnsavedChanges?: boolean;
  notice?: ReactNode;
  title: string;
};

export function AdminDetailPanel({ actions, backHref, children, description, eyebrow, hasUnsavedChanges = false, notice, title }: AdminDetailPanelProps) {
  const router = useRouter();
  const close = () => {
    if (!hasUnsavedChanges || window.confirm("Bạn có thay đổi chưa lưu. Bạn vẫn muốn rời khỏi màn hình này?")) router.push(backHref);
  };

  return <section className="admin-detail-panel">
    <header className="admin-detail-panel__header">
      <div><p>{eyebrow}</p><h1 title={title}>{title}</h1><small>{description}</small></div>
      <div className="admin-detail-panel__header-actions">{actions}<button aria-label="Đóng và quay lại danh sách" className="admin-detail-panel__close" onClick={close} title="Đóng và quay lại danh sách" type="button"><X aria-hidden="true" size={18} /></button></div>
    </header>
    <div className="admin-detail-panel__body"><div className="admin-detail-panel__content">{notice}{children}</div></div>
  </section>;
}
