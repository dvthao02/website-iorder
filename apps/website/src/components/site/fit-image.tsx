import Image from "next/image";
import React from "react";

// Ảnh minh họa / ảnh chụp giao diện / ảnh sản phẩm đặt vào khung có tỉ lệ cố định: ảnh gốc có thể dọc (trạm sạc), ngang dài (sơ đồ, bảng) hay gần vuông (laptop), nên
// `object-fit: cover` luôn cắt mất một phần (logo sát mép, chân thiết bị). Component này luôn hiện ĐỦ ảnh trong khung:
// - ảnh chính `object-contain` (không cắt, không méo);
// - phía sau là chính ảnh đó phóng to và làm mờ, nên phần thừa hai bên hoặc trên dưới liền màu với ảnh thay vì một dải trống.
//   Bản mờ chỉ xin ảnh rất nhỏ (96px) nên gần như không tốn thêm tải; ảnh nền trong suốt (PNG/WebP) thì bản mờ gần như vô hình và khung giữ màu nền riêng của nó.
// Dùng giống `fill` của next/image: thẻ cha phải `relative overflow-hidden` và có kích thước (aspect-ratio hoặc chiều cao). Ảnh chụp thật phủ kín khung
// (ảnh cửa hàng, ảnh nền) thì KHÔNG dùng component này mà để `object-cover`.
export function FitImage({ alt, builderField, builderItem, className = "", preload = false, sizes, url }: {
  alt: string;
  /** `data-builder-field` / `data-builder-item` gắn trên ảnh chính để bấm trên canvas CMS chọn đúng chỗ. */
  builderField?: string;
  builderItem?: string;
  /** Lớp thêm cho ảnh chính (ví dụ hiệu ứng phóng nhẹ khi rê chuột). */
  className?: string;
  preload?: boolean;
  sizes: string;
  url: string;
}) {
  return <>
    <Image alt="" aria-hidden="true" className="scale-125 object-cover opacity-80 blur-2xl" fill sizes="96px" src={url} />
    <Image alt={alt} className={`object-contain ${className}`.trim()} data-builder-field={builderField} data-builder-item={builderItem} fill preload={preload} sizes={sizes} src={url} />
  </>;
}
