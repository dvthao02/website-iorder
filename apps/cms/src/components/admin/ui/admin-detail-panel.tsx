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
  notice?: ReactNode;
  title: string;
};

export function AdminDetailPanel({ actions, backHref, children, description, eyebrow, notice, title }: AdminDetailPanelProps) {
  const router = useRouter();

  return <section className="admin-detail-panel">
    <header className="admin-detail-panel__header">
      <div><p>{eyebrow}</p><h1 title={title}>{title}</h1><small>{description}</small></div>
      <div className="admin-detail-panel__header-actions">{actions}<button aria-label="Đóng và quay lại danh sách" className="admin-detail-panel__close" onClick={() => router.push(backHref)} title="Đóng và quay lại danh sách" type="button"><X aria-hidden="true" size={18} /></button></div>
    </header>
    <div className="admin-detail-panel__body">{notice}{children}</div>
  </section>;
}
