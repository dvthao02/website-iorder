"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";
import { useNavigationGuard } from "./use-navigation-guard";

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
  useNavigationGuard(hasUnsavedChanges);

  return <section className="admin-detail-panel">
    <header className="admin-detail-panel__header">
      <div className="admin-detail-panel__heading"><p>{eyebrow}</p><h1 title={title}>{title}</h1><small>{description}</small></div>
      <div className="admin-detail-panel__header-actions">{actions}<Link aria-label="Đóng và quay lại danh sách" className="admin-detail-panel__close" href={backHref} title="Đóng và quay lại danh sách"><X aria-hidden="true" size={18} /></Link></div>
    </header>
    <div className="admin-detail-panel__body"><div className="admin-detail-panel__content">{notice}{children}</div></div>
  </section>;
}
