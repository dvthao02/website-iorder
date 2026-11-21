import type { ReactNode } from "react";

type AdminPopoverProps = {
  children: ReactNode;
  className: string;
  label: string;
  trigger: ReactNode;
};

export function AdminPopover({ children, className, label, trigger }: AdminPopoverProps) {
  return (
    <details className={`admin-popover ${className}`}>
      <summary aria-label={label}>{trigger}</summary>
      {children}
    </details>
  );
}
