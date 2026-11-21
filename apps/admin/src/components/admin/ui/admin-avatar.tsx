import NextImage from "next/image";
import type { CSSProperties } from "react";

/** Chữ cái đầu của hai từ cuối trong họ tên, dùng khi tài khoản chưa có ảnh đại diện. */
export function adminInitials(fullName: string) {
  return fullName.split(/\s+/).filter(Boolean).slice(-2).map((word) => word[0]).join("").toUpperCase() || "AD";
}

type AdminAvatarProps = {
  fullName: string;
  avatarUrl?: string | null;
  /** Cạnh ảnh tròn, tính bằng px. */
  size?: number;
  className?: string;
};

/**
 * Ảnh đại diện tròn của tài khoản CMS. Chỉ là hình trang trí (tên người luôn nằm cạnh bên) nên ẩn khỏi trình đọc màn hình.
 * Ảnh phục vụ qua /media/… với tên theo UUID, không đổi nội dung sau khi tải lên, nên không cần tối ưu hóa lại.
 */
export function AdminAvatar({ fullName, avatarUrl, size = 28, className = "" }: AdminAvatarProps) {
  return <span aria-hidden="true" className={`admin-avatar ${className}`.trim()} style={{ "--admin-avatar-size": `${size}px` } as CSSProperties}>
    {avatarUrl ? <NextImage alt="" height={size * 2} src={avatarUrl} unoptimized width={size * 2} /> : adminInitials(fullName)}
  </span>;
}
