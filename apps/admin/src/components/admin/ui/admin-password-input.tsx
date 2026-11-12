"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

/** Ô mật khẩu có nút hiện/ẩn để kiểm tra lại trước khi gửi (đăng nhập, đổi mật khẩu, đặt mật khẩu tài khoản). */
export function AdminPasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return <span className="admin-password-input">
    <input {...props} className={`admin-input ${className}`.trim()} type={visible ? "text" : "password"} />
    <button aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={visible} className="admin-password-input__toggle" onClick={() => setVisible((current) => !current)} title={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} type="button">
      {visible ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
    </button>
  </span>;
}
