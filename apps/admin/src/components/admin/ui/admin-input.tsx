import type { InputHTMLAttributes } from "react";

export function AdminInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`admin-input ${className}`.trim()} {...props} />;
}
