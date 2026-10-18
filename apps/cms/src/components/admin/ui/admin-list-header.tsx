import type { ReactNode } from "react";

import { AdminPageBarActions, AdminPageBarMeta } from "./admin-page-bar";

type AdminListHeaderProps = {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  headingLevel?: 1 | 2;
  title: string;
};

// Tên màn đã hiện trên thanh vị trí của khung CMS, nên ở đây tiêu đề chỉ dành cho trình đọc màn hình;
// số liệu tóm tắt và nút hành động được đưa lên thanh đó để không lặp thông tin.
export function AdminListHeader({ actions, description, headingLevel = 1, title }: AdminListHeaderProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return <>
    <Heading className="admin-list-header sr-only">{title}</Heading>
    <AdminPageBarMeta>{description}</AdminPageBarMeta>
    {actions ? <AdminPageBarActions>{actions}</AdminPageBarActions> : null}
  </>;
}
