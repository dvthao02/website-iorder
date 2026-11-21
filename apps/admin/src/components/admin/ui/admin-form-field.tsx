import React, { type ReactNode } from "react";

import { AdminHelpTip } from "./admin-help-tip";

// Nhãn chỉ chứa tên trường; lỗi nằm ngoài label để không bị đọc lặp thành tên ô nhập.
// Hướng dẫn (hint) không chiếm dòng riêng: hiện ở biểu tượng ⓘ cạnh nhãn khi rê chuột hoặc focus.
export function AdminFormField({ id, label, children, error, hint, wide = false }: {
  id: string;
  label: string;
  children: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  wide?: boolean;
}) {
  return <div className={wide ? "admin-field admin-field--wide" : "admin-field"}>
    {hint ? <div className="admin-label-row"><label htmlFor={id}>{label}</label><AdminHelpTip label={`Giải thích: ${label}`}>{hint}</AdminHelpTip></div> : <label htmlFor={id}>{label}</label>}
    {children}
    {error}
  </div>;
}
