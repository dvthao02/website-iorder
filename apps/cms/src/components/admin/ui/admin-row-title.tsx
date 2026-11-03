import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";

// Ô tiêu đề có ảnh thu nhỏ cho bảng nội dung (như danh sách sản phẩm của Shopify, list view của Payload):
// nhận ra mục bằng mắt nhanh hơn đọc tên, và thấy ngay mục nào còn thiếu ảnh bìa.
export function AdminRowTitle({ href, imageUrl, title }: { href: string; imageUrl: string | null; title: string }) {
  return <Link className="admin-row-title" href={href}>
    <span className="admin-row-title__thumb">
      {imageUrl ? <Image alt="" className="object-contain" fill sizes="40px" src={imageUrl} unoptimized /> : <ImageIcon aria-label="Chưa có ảnh bìa" size={14} />}
    </span>
    <span className="admin-row-title__text">{title}</span>
  </Link>;
}
