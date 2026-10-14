import Link from "next/link";
import React, { type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";

type SharedProps = {
  children: ReactNode;
  className?: string;
  leadingIcon?: ReactNode;
  variant?: "primary" | "secondary" | "danger";
};

type AdminButtonProps = SharedProps & (
  | (Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps> & { href?: never; target?: never })
  | (Omit<ComponentProps<typeof Link>, keyof SharedProps | "href" | "type"> & { href: string; disabled?: never; type?: never })
);

export function AdminButton({ children, className = "", leadingIcon, variant = "primary", ...props }: AdminButtonProps) {
  const classes = `admin-button admin-button--${variant} ${className}`.trim();
  const content = <React.Fragment>{leadingIcon}{children}</React.Fragment>;

  if (props.href !== undefined) {
    return <Link {...props} className={classes}>{content}</Link>;
  }

  return <button {...props} className={classes} type={props.type ?? "button"}>{content}</button>;
}
