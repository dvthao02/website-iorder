import type { HTMLAttributes, ReactNode } from "react";

type AdminListPageProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "default" | "dense";
};

export function AdminListPage({ children, className = "", variant = "default", ...props }: AdminListPageProps) {
  return <div className={`admin-list-page admin-list-page--${variant} ${className}`.trim()} {...props}>{children}</div>;
}
