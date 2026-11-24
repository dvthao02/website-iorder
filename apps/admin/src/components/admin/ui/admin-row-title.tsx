import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Lock, Pencil } from "lucide-react";

// Ô tiêu đề có ảnh thu nhỏ cho bảng nội dung (như danh sách sản phẩm của Shopify, list view của Payload):
// nhận ra mục bằng mắt nhanh hơn đọc tên, và thấy ngay mục nào còn thiếu ảnh bìa.
export function AdminRowTitle({ href, imageUrl, locked, title }: { href: string; imageUrl: string | null; /** Mục đang bị khóa chỉnh sửa: hiện ổ khóa sau tiêu đề; chuỗi là chú thích (ai khóa). */ locked?: string | false; title: string }) {
  return <Link className="admin-row-title" href={href}>
    <span className="admin-row-title__thumb">
      {imageUrl ? <Image alt="" className="object-contain" fill sizes="40px" src={imageUrl} /> : <ImageIcon aria-label="Chưa có ảnh bìa" size={14} />}
    </span>
    <span className="admin-row-title__text">{title}</span>
    {locked !== undefined && locked !== false ? <span className="shrink-0 text-[var(--cms-muted)]" title={locked || "Đã khóa"}><Lock aria-label={locked || "Đã khóa"} size={13} /></span> : null}
  </Link>;
}

/** Bút chì ở cột "Thao tác" của bảng mở khung sửa khi bấm dòng: chỉ là biểu tượng (bấm vào = bấm dòng; bàn phím dùng Enter trên dòng). */
export function AdminRowEditIcon() {
  return <span className="admin-content-actions"><span aria-hidden="true" className="admin-content-actions__button admin-content-actions__edit" title="Sửa"><Pencil size={16} /></span></span>;
}
