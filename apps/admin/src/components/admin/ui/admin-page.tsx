import type { ReactNode } from "react";

type AdminPageProps = {
  children: ReactNode;
  className?: string;
  /** padded: nội dung có lề chung (cài đặt, bảng điều khiển). flush: màn danh sách một thẻ bảng, thẻ tràn khít vùng nội dung, không lề. */
  variant?: "padded" | "flush";
};

/** Khung nội dung chung của mọi màn trong CMS (danh sách, cài đặt); lề và kiểu thẻ chỉ chọn ở đây, không vá bằng CSS từng trang. */
export function AdminPage({ children, className = "", variant = "padded" }: AdminPageProps) {
  return <main className={`admin-page admin-page--${variant} ${className}`.trim()}>{children}</main>;
}
