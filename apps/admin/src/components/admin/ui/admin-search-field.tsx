import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

type AdminSearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

/** Ô tìm kiếm chuẩn của màn danh sách: biểu tượng kính lúp bên trái, Enter để tìm. */
export function AdminSearchField({ className = "", label, ...props }: AdminSearchFieldProps) {
  return <div className={`admin-search ${className}`.trim()}>
    <Search aria-hidden="true" size={15} />
    <input aria-label={label} type="search" {...props} />
  </div>;
}
