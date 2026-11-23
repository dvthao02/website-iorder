import React, { type InputHTMLAttributes, type ReactNode } from "react";

/** Ô tích kèm nhãn: toàn bộ dòng bấm được. className áp cho nhãn; mọi thuộc tính khác (checked, onChange, disabled…) đi vào ô tích. */
export function AdminCheckbox({ children, className = "", ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { children: ReactNode }) {
  return <label className={`admin-check ${className}`.trim()}><input {...input} type="checkbox" />{children}</label>;
}
