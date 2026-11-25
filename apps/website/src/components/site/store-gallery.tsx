import type { PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { BlockIcon } from "./block-icon";
import { HeroImages } from "./hero-images";
import { loadBlockImages } from "./section-blocks";
import { SiteLink } from "./site-link";
import { StoreCarousel } from "./store-carousel";
import { getBuilderPreviewContext } from "@/lib/builder-preview";
import { getT } from "@/lib/messages";

type GalleryItem = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>["data"]["items"][number];

// Lưới tối đa 9 thẻ (ảnh to + 4 ảnh + hàng 4 ảnh). Nhiều hơn 9 thì lưới giữ 5 thẻ đầu, các thẻ còn lại thành dải 4 ảnh tự trượt ở cuối.
const gridLimit = 9;
const gridWhenSliding = 5;

// "Ảnh cửa hàng thực tế": lưới ảnh các cửa hàng đang dùng iOrder, tên và mô tả (loại hình, khu vực) nằm đè ở chân ảnh.
// Từ 5 ảnh thì ảnh đầu to gấp đôi (hai cột × hai hàng) làm điểm nhấn. Thẻ có nhiều ảnh thì tự đổi ảnh; có đường dẫn thì cả ảnh bấm được.
// Dải trượt ở cuối chỉ dùng ảnh đầu của mỗi thẻ.
export async function StoreGallery({ items, first = false }: { items: GalleryItem[]; first?: boolean }) {
  const t = await getT();
  const galleries = await Promise.all(items.map(item => loadBlockImages([item.mediaId, ...(item.extraMediaIds ?? [])])));
  // Ảnh trong màn hình đầu thì tải ngay (như hero: khối đầu trang) để không thành ảnh LCP bị lazy; khung xem trước CMS cuộn thẳng tới khối đang chọn nên cũng tải ngay.
  const eager = first || Boolean(await getBuilderPreviewContext());
  const sliding = items.length > gridLimit;
  const gridCount = sliding ? gridWhenSliding : items.length;
  const slides = sliding ? items.slice(gridCount).map((item, index) => {
    const photo = galleries[gridCount + index][0];
    return { title: item.title, description: item.description || null, href: item.href, image: photo ? { url: photo.url, alt: photo.altText ?? item.title, kind: "photo" as const } : null };
  }) : [];
  return <>
    <div className={gridCount >= 5 ? "store-gallery store-gallery--featured" : "store-gallery"} data-count={gridCount}>
      {items.slice(0, gridCount).map((item, index) => {
        const photos = galleries[index];
        const content = <>
          <span className="store-gallery__media">
            {photos.length
              ? <HeroImages builderItem={null} imageClassName="object-cover transition duration-500 group-hover:scale-[1.03]" images={photos.map(photo => ({ url: photo.url, alt: photo.altText ?? item.title }))} preload={eager && index < 3} sizes="(min-width: 1024px) 34vw, (min-width: 640px) 50vw, 100vw" variant="cover" />
              : <span aria-hidden="true" className="store-gallery__empty"><BlockIcon name="store" size={40} strokeWidth={1.4} /></span>}
          </span>
          <figcaption className="store-gallery__caption">
            <strong data-builder-field="title">{item.title}</strong>
            {item.description ? <span data-builder-field="description">{item.description}</span> : null}
          </figcaption>
        </>;
        return <figure className="store-gallery__tile group" data-builder-item={`items:${index}`} key={`${item.title}-${index}`}>
          {item.href ? <SiteLink className="store-gallery__link" data-builder-field="href" href={item.href}>{content}</SiteLink> : content}
        </figure>;
      })}
    </div>
    {slides.length ? <div className="store-gallery__slider"><StoreCarousel firstIndex={gridCount} label={t("gallery.otherCustomers")} slides={slides} variant="quad" /></div> : null}
  </>;
}
