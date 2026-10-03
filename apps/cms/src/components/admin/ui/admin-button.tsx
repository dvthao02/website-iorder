import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  target?: string;
  variant?: "primary" | "secondary" | "danger";
};

export function AdminButton({ children, className = "", href, target, type = "button", variant = "primary", ...props }: AdminButtonProps) {
  const classes = `admin-button admin-button--${variant} ${className}`.trim();

  if (href) return <Link className={classes} href={href} target={target}>{children}</Link>;

  return <button className={classes} type={type} {...props}>{children}</button>;
}
