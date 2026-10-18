import Link from "next/link";
import React, { type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";

import type { CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { useOptionalAdminPermissions } from "./admin-permissions";

type SharedProps = {
  children: ReactNode;
  className?: string;
  leadingIcon?: ReactNode;
  /** Disables the button (or hides it with hideWithoutPermission) when the actor lacks it; a list means any of them. UI only; the API still enforces. */
  permission?: CmsPermissionCode | readonly CmsPermissionCode[];
  hideWithoutPermission?: boolean;
  size?: "md" | "sm";
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

type AdminButtonProps = SharedProps & (
  | (Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps> & { href?: never; target?: never })
  | (Omit<ComponentProps<typeof Link>, keyof SharedProps | "href" | "type"> & { href: string; disabled?: never; type?: never })
);

const deniedTitle = "Bạn không có quyền thực hiện thao tác này.";

// Only buttons that declare a permission read the permission context.
export function AdminButton(props: AdminButtonProps) {
  return props.permission ? <PermissionedAdminButton {...props} /> : renderAdminButton(props, true);
}

function PermissionedAdminButton(props: AdminButtonProps) {
  const { can, canAny } = useOptionalAdminPermissions();
  const permission = props.permission!;
  const allowed = typeof permission === "string" ? can(permission) : canAny(permission);
  return !allowed && props.hideWithoutPermission ? null : renderAdminButton(props, allowed);
}

function renderAdminButton({ children, className = "", leadingIcon, size = "md", variant = "primary", ...rest }: AdminButtonProps, allowed: boolean) {
  const props = { ...rest };
  delete props.permission;
  delete props.hideWithoutPermission;
  const classes = `admin-button admin-button--${variant}${size === "sm" ? " admin-button--sm" : ""} ${className}`.trim();
  const content = <React.Fragment>{leadingIcon}{children}</React.Fragment>;

  if (props.href !== undefined) {
    return allowed ? <Link {...props} className={classes}>{content}</Link> : <span aria-disabled="true" className={`${classes} admin-button--disabled`} title={deniedTitle}>{content}</span>;
  }

  return <button {...props} className={classes} disabled={props.disabled || !allowed} title={allowed ? props.title : deniedTitle} type={props.type ?? "button"}>{content}</button>;
}
