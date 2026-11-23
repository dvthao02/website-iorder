import React, { type ReactNode } from "react";

/**
 * Màn thông báo cả trang của CMS (không có quyền, không tìm thấy, lỗi tải khu vực): một thẻ giữa trang với biểu tượng,
 * dòng nhãn, tiêu đề, giải thích và một hành động. Dùng chung để ba màn này không lệch nhau.
 */
export function AdminMessagePage({ action, description, eyebrow, icon, title }: {
  action?: ReactNode;
  description: string;
  eyebrow: string;
  icon: ReactNode;
  title: string;
}) {
  return <main className="admin-message">
    <section>
      {icon}
      <div className="grid gap-1">
        <p className="admin-field__hint">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="admin-help">{description}</p>
      </div>
      {action}
    </section>
  </main>;
}
