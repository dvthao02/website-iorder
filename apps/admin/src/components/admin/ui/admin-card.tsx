import type { HTMLAttributes, ReactNode } from "react";

type AdminCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function AdminCard({ children, className = "", ...props }: AdminCardProps) {
  return <section className={`admin-card ${className}`.trim()} {...props}>{children}</section>;
}

export function AdminCardHeader({ children, className = "", ...props }: AdminCardProps) {
  return <header className={`admin-card__header ${className}`.trim()} {...props}>{children}</header>;
}
