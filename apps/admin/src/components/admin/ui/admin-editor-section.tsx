"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AdminCard } from "./admin-card";

type AdminEditorSectionProps = {
  children: ReactNode;
  className?: string;
  description?: string;
  id?: string;
  step?: number;
  title: string;
};

/**
 * Khung nội dung dùng chung cho editor dài: thứ tự bước nhìn thấy ngay,
 * còn nội dung nghiệp vụ vẫn giữ nguyên trong từng màn.
 */
export function AdminEditorSection({ children, className = "", description, id, step, title }: AdminEditorSectionProps) {
  return <AdminCard className={`admin-editor-section ${className}`.trim()} id={id}>
    <header>
      <div className="admin-editor-section__heading">
        {step ? <span aria-hidden="true" className="admin-editor-section__step">{step}</span> : null}
        <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
      </div>
    </header>
    {children}
  </AdminCard>;
}

type AdminEditorOutlineItem = {
  description?: string;
  href: string;
  label: string;
  step: number;
};

export function AdminEditorOutline({ items, label = "Bố cục nội dung", onSelect }: { items: AdminEditorOutlineItem[]; label?: string; onSelect?: (index: number) => void }) {
  const targets = items.map((item) => item.href).join("|");
  const [activeHref, setActiveHref] = useState(items[0]?.href ?? "");

  useEffect(() => {
    const hrefs = targets.split("|").filter(Boolean);
    const sections = hrefs.map((href) => document.getElementById(href.slice(1))).filter((section): section is HTMLElement => section !== null);
    const root = document.querySelector<HTMLElement>(".admin-editor-detail-page .admin-detail-panel__body");
    if (!sections.length || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => Math.abs(a.boundingClientRect.top - (root?.getBoundingClientRect().top ?? 0)) - Math.abs(b.boundingClientRect.top - (root?.getBoundingClientRect().top ?? 0)));
      const section = visible[0]?.target as HTMLElement | undefined;
      if (section) setActiveHref(`#${section.id}`);
    }, { root, rootMargin: "-12% 0px -72% 0px", threshold: 0 });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [targets]);

  return <nav aria-label={label} className="admin-editor-outline">
    <p>{label}</p>
    <ol>{items.map((item, index) => <li key={item.href}><a aria-current={activeHref === item.href ? "location" : undefined} href={item.href} onClick={() => { setActiveHref(item.href); onSelect?.(index); }}><span>{item.step}</span><strong>{item.label}{item.description ? <small>{item.description}</small> : null}</strong></a></li>)}</ol>
  </nav>;
}
