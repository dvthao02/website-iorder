import type { ReactNode } from "react";

// Nhãn chỉ chứa tên trường; lỗi/hướng dẫn nằm ngoài label để không bị đọc lặp thành tên ô nhập.
export function AdminFormField({ id, label, children, error, hint, wide = false }: {
  id: string;
  label: string;
  children: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  wide?: boolean;
}) {
  return <div className={wide ? "admin-field admin-field--wide" : "admin-field"}>
    <label htmlFor={id}>{label}</label>
    {children}
    {hint ? <small className="admin-help" id={`${id}-hint`}>{hint}</small> : null}
    {error}
  </div>;
}
