import React, { type InputHTMLAttributes, type ReactNode } from "react";

/** Một lựa chọn trong nhóm radio đơn giản (nhãn bên phải ô tròn). Lựa chọn dạng thẻ có hình riêng (LayoutPicker, ContentStatusChoice) giữ kiểu của chúng. */
export function AdminRadio({ children, className = "", ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { children: ReactNode }) {
  return <label className={`admin-radio ${className}`.trim()}><input {...input} type="radio" />{children}</label>;
}
