import type { ReactNode } from "react";

type AdminEditorActionsProps = {
  children: ReactNode;
  className?: string;
  variant?: "fixed" | "inline";
};

export function AdminEditorActions({ children, className = "", variant = "fixed" }: AdminEditorActionsProps) {
  return <div className={`admin-editor-actions admin-editor-actions--${variant} ${className}`.trim()}>{children}</div>;
}
