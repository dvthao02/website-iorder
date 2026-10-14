import type { FormHTMLAttributes, ReactNode } from "react";

type AdminFilterBarProps = FormHTMLAttributes<HTMLFormElement> & {
  actions?: ReactNode;
  bulkActions?: ReactNode;
  children: ReactNode;
};

export function AdminFilterBar({ actions, bulkActions, children, className = "", ...props }: AdminFilterBarProps) {
  return <form className={`admin-filter-bar ${className}`.trim()} {...props}>
    <div className="admin-filter-bar__controls">{children}</div>
    {bulkActions ? <div className="admin-filter-bar__bulk-actions">{bulkActions}</div> : null}
    {actions ? <div className="admin-filter-bar__actions">{actions}</div> : null}
  </form>;
}
