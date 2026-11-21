import { isDarkColor } from "@iorder/shared/server/shared/color";
import type { PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { HeroImages } from "./hero-images";
import { loadBlockImages } from "./section-blocks";
import { SiteLink } from "./site-link";
import { descriptionLines, mosaicMediaKind, mosaicRows } from "@/lib/mosaic-layout";

type MosaicItem = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>["data"]["items"][number];

// "Ảnh ghép": các ô xếp hai hàng (nửa trên ít ô nên rộng hơn). Có ba kiểu ô, chọn theo ảnh của thẻ:
// - Không có ảnh ("text"): ô phẳng kẻ viền, số thứ tự, tiêu đề lớn, mô tả (mỗi dòng một ý) luôn hiện; rê chuột thì tô xanh thương hiệu.
//   Đây là kiểu mặc định, không cần ảnh dựng sẵn.
// - Ảnh chụp thật (JPG): ảnh phủ kín ô, lớp tối cho chữ đọc rõ; rê chuột/bàn phím thì mô tả trượt lên.
// - Ảnh sản phẩm nền trong suốt (PNG/WebP): đặt to ở góc ô cùng kiểu ô phẳng; rê chuột/bàn phím thì mô tả trượt lên (thẻ có màu riêng trong CMS thì dùng màu đó).
export async function EcosystemMosaic({ items }: { items: MosaicItem[] }) {
  const galleries = await Promise.all(items.map(item => loadBlockImages([item.mediaId, ...(item.extraMediaIds ?? [])])));
  const kinds = galleries.map(images => images.length ? mosaicMediaKind(images[0].mimeType) : "text");
  const textOnly = kinds.every(kind => kind === "text");
  const sizes = mosaicRows(items.length);
  return <div className="mosaic" data-text-only={textOnly ? "" : undefined}>
    {sizes.map((size, rowIndex) => {
      const start = sizes.slice(0, rowIndex).reduce((sum, count) => sum + count, 0);
      const row = items.slice(start, start + size).map((item, offset) => ({ item, index: start + offset }));
      return <div className="mosaic__row" key={rowIndex}>
        {row.map(({ item, index }) => {
          const images = galleries[index];
          const kind = kinds[index];
          const lines = descriptionLines(item.description);
          // Nền riêng của thẻ (nếu có) áp cho ô ảnh sản phẩm nền trong suốt; màu tối thì chữ trắng.
          const dark = kind === "photo" ? true : kind === "cutout" ? Boolean(item.background && isDarkColor(item.background)) : false;
          const text = <>
            {lines.length > 1 ? <ul className="mosaic__list">{lines.map(line => <li key={line}>{line}</li>)}</ul> : lines[0] ? <p className="mosaic__text">{lines[0]}</p> : null}
            {item.href && kind !== "text" ? <span className="mosaic__more">Xem thêm →</span> : null}
          </>;
          const content = <>
            {kind === "text" ? null : <div className={`mosaic__media mosaic__media--${kind}`}>
              <HeroImages builderItem={null} imageClassName={kind === "photo" ? "object-cover transition duration-700 group-hover:scale-[1.05]" : "object-contain object-center transition duration-500 group-hover:scale-[1.04]"} images={images.map(photo => ({ url: photo.url, alt: photo.altText ?? item.title }))} preload={false} sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw" variant="cover" />
            </div>}
            {kind === "photo" ? <span aria-hidden="true" className="mosaic__scrim" /> : null}
            {kind === "text" || kind === "cutout" ? <div aria-hidden="true" className="mosaic__head"><span className="mosaic__num">{String(index + 1).padStart(2, "0")}</span>{item.href ? <ArrowRight className="mosaic__arrow" size={20} strokeWidth={1.8} /> : null}</div> : null}
            <div className="mosaic__body">
              <strong className="mosaic__title" data-builder-field="title">{item.title}</strong>
              {lines.length || (item.href && kind !== "text") ? <div className="mosaic__reveal"><div className="mosaic__reveal-inner" data-builder-field="description">{text}</div></div> : null}
            </div>
          </>;
          // Số thẻ lẻ: thẻ cuối trải hết chiều ngang khi lưới hai cột (máy tính bảng) để không lẻ một ô.
          const wide = index === items.length - 1 && items.length % 2 === 1 ? "" : undefined;
          const style = (kind === "cutout" && item.background ? { backgroundColor: item.background, backgroundImage: "none", "--mosaic-bg": item.background } : undefined) as unknown as CSSProperties | undefined;
          return item.href
            ? <SiteLink className="mosaic__tile group" data-builder-item={`items:${index}`} data-kind={kind} data-tone={dark ? "dark" : "light"} data-wide={wide} href={item.href} key={`${item.title}-${index}`} style={style}>{content}</SiteLink>
            : <div className="mosaic__tile group" data-builder-item={`items:${index}`} data-kind={kind} data-tone={dark ? "dark" : "light"} data-wide={wide} key={`${item.title}-${index}`} style={style}>{content}</div>;
        })}
      </div>;
    })}
  </div>;
}
