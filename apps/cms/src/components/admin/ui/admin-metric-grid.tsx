import type { ReactNode } from "react";

type AdminMetric = {
  icon?: ReactNode;
  label: string;
  tone?: "blue" | "green" | "amber" | "slate";
  value: ReactNode;
};

export function AdminMetricGrid({ items }: { items: AdminMetric[] }) {
  return <section aria-label="Tóm tắt dữ liệu" className="admin-metric-grid">
    {items.map((item) => <article className={`admin-metric-card admin-metric-card--${item.tone ?? "slate"}`} key={item.label}>
      {item.icon ? <span className="admin-metric-card__icon">{item.icon}</span> : null}
      <span className="admin-metric-card__content"><small>{item.label}</small><strong>{item.value}</strong></span>
    </article>)}
  </section>;
}
