import type { ReactNode } from "react";

export function AdminEmptyState({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <div className="admin-empty-state">
      <div>
        {icon ? <span className="admin-empty-state__icon">{icon}</span> : null}
        <h3 className="admin-empty-state__title">{title}</h3>
        <p className="admin-empty-state__description">{description}</p>
        {action ? <div className="admin-empty-state__action">{action}</div> : null}
      </div>
    </div>
  );
}
