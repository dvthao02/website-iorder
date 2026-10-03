import type { ButtonHTMLAttributes, ReactNode } from "react";

type AdminIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function AdminIconButton({ children, className = "", type = "button", ...props }: AdminIconButtonProps) {
  return <button className={`admin-icon-button ${className}`.trim()} type={type} {...props}>{children}</button>;
}
