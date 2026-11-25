import React, { type ReactNode } from "react";

// Nút tải tệp cài đặt. Tệp trong thư viện của iOrder tải thẳng (thuộc tính download); link ngoài mở ở tab mới
// (trình duyệt bỏ qua `download` với địa chỉ khác nguồn nên không gắn), kèm rel để trang đích không đọc được trang này.
export function DownloadButton({ href, external, className = "button button--primary", children }: { href: string; external: boolean; className?: string; children: ReactNode }) {
  return external
    ? <a className={className} href={href} rel="noopener noreferrer" target="_blank">{children}</a>
    : <a className={className} download href={href}>{children}</a>;
}
