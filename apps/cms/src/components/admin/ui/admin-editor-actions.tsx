import type { ReactNode } from "react";

export function AdminEditorActions({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`admin-editor-actions ${className}`.trim()}>{children}</div>;
}
