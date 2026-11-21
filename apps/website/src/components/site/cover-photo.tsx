import Image from "next/image";
import { HeroImages } from "./hero-images";

export type CoverPhotoImage = { url: string; altText: string | null };

// Ảnh phủ kín khung cha (`relative`) của thẻ: một ảnh thì hiện như cũ, từ 2 ảnh thì tự chuyển ảnh.
export function CoverPhoto({ photos, alt, className, sizes, preload = false }: { photos: ReadonlyArray<CoverPhotoImage>; alt: string; className: string; sizes: string; preload?: boolean }) {
  if (photos.length > 1) return <HeroImages builderItem={null} imageClassName={className} images={photos.map(photo => ({ url: photo.url, alt: photo.altText ?? alt }))} preload={preload} sizes={sizes} variant="cover" />;
  const photo = photos[0];
  return photo ? <Image alt={photo.altText ?? alt} className={className} data-builder-field="image" fill preload={preload} sizes={sizes} src={photo.url} /> : null;
}
