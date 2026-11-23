import Image from "next/image";
import React from "react";
import { FitImage } from "./fit-image";
import { HeroImages } from "./hero-images";

export type CoverPhotoImage = { url: string; altText: string | null };

// Ảnh trong khung cha (`relative overflow-hidden`) của thẻ: một ảnh thì hiện như cũ, từ 2 ảnh thì tự chuyển ảnh.
// `fit="cover"` (mặc định): ảnh chụp thật phủ kín khung, cắt phần thừa (`className` nên có object-cover).
// `fit="contain"`: ảnh minh họa / giao diện / sản phẩm hiện đủ trong khung, không cắt (xem FitImage); `className` chỉ cần hiệu ứng (phóng nhẹ khi rê chuột).
export function CoverPhoto({ photos, alt, className, sizes, preload = false, fit = "cover" }: { photos: ReadonlyArray<CoverPhotoImage>; alt: string; className: string; sizes: string; preload?: boolean; fit?: "cover" | "contain" }) {
  if (photos.length > 1) return <HeroImages builderItem={null} fit={fit} imageClassName={className} images={photos.map(photo => ({ url: photo.url, alt: photo.altText ?? alt }))} preload={preload} sizes={sizes} variant="cover" />;
  const photo = photos[0];
  if (!photo) return null;
  return fit === "contain"
    ? <FitImage alt={photo.altText ?? alt} builderField="image" className={className} preload={preload} sizes={sizes} url={photo.url} />
    : <Image alt={photo.altText ?? alt} className={className} data-builder-field="image" fill preload={preload} sizes={sizes} src={photo.url} />;
}
