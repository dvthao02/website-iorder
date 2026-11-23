import React, { type SelectHTMLAttributes } from "react";

/** Ô chọn một giá trị trong biểu mẫu, cùng kiểu với AdminInput. (Ô chọn trong thanh lọc được thanh lọc tạo kiểu, không dùng lớp này.) */
export function AdminSelect({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`admin-input ${className}`.trim()} {...props} />;
}
