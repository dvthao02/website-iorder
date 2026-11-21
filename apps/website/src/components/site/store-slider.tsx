import type { PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { mosaicMediaKind } from "@/lib/mosaic-layout";
import { loadBlockImages } from "./section-blocks";
import { StoreCarousel } from "./store-carousel";

type SliderItem = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>["data"]["items"][number];

// "Dải ảnh trượt tự động": mỗi thẻ là một ảnh (ảnh đầu của thẻ), tên và mô tả chỉ hiện khi rê chuột/bàn phím; có đường dẫn thì bấm được cả ảnh.
// Ảnh chụp (JPG) phủ kín khung; ảnh sản phẩm nền trong suốt (PNG/WebP) nằm trọn trong khung trên nền sáng. Dùng thay phần đánh giá bằng ảnh cửa hàng thực tế. Phần tương tác (tự trượt, dừng, chấm chuyển ảnh) nằm ở StoreCarousel.
export async function StoreSlider({ items, label }: { items: SliderItem[]; label: string }) {
  const galleries = await Promise.all(items.map(item => loadBlockImages([item.mediaId, ...(item.extraMediaIds ?? [])])));
  const slides = items.map((item, index) => {
    const photo = galleries[index][0];
    return { title: item.title, description: item.description || null, href: item.href, image: photo ? { url: photo.url, alt: photo.altText ?? item.title, kind: mosaicMediaKind(photo.mimeType) } : null };
  });
  return <StoreCarousel label={label} slides={slides} />;
}
