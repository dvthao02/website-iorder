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
    <div className="admin-empty-state grid min-h-52 place-items-center rounded-xl border border-dashed p-6 text-center">
      <div className="grid max-w-md justify-items-center gap-3">
        {icon ? <span className="admin-empty-state__icon grid h-11 w-11 place-items-center rounded-full shadow-sm">{icon}</span> : null}
        <div>
          <h3 className="admin-empty-state__title text-base font-extrabold">{title}</h3>
          <p className="admin-empty-state__description mt-1 text-sm leading-6">{description}</p>
        </div>
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </div>
  );
}
