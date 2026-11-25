import Image from "next/image";
import type { CSSProperties } from "react";
import type { PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { getMediaById, getSiteProfile } from "@/lib/backend";
import { BlockIcon } from "./block-icon";
import { HeroImages } from "./hero-images";
import { OrbitHub } from "./orbit-hub";
import { loadBlockImages } from "./section-blocks";
import { SiteLink } from "./site-link";
import { getT } from "@/lib/messages";

type OrbitItem = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>["data"]["items"][number];

// "Hệ sinh thái" dạng quỹ đạo: vòng tròn thương hiệu ở giữa, các nhóm giải pháp xếp quanh (biểu tượng, tên, mô tả, Xem thêm, ảnh sản phẩm
// nền trong suốt). Số thẻ lẻ thì thẻ đầu nằm trên cùng, các thẻ còn lại chia đôi hai bên; điện thoại xếp một cột.
export async function EcosystemOrbit({ items, dark = false }: { items: OrbitItem[]; dark?: boolean }) {
  const t = await getT();
  const profile = await getSiteProfile();
  const logo = profile?.logoMediaId ? await getMediaById(profile.logoMediaId) : null;
  const brand = profile?.companyName ?? "iOrder";
  const galleries = await Promise.all(items.map(item => loadBlockImages([item.mediaId, ...(item.extraMediaIds ?? [])])));
  const hasTop = items.length % 2 === 1;
  const offset = hasTop ? 1 : 0;
  const pairs = Math.max(1, Math.ceil((items.length - offset) / 2));
  // Vị trí lưới của từng thẻ (chỉ áp dụng từ màn lg trở lên).
  const place = (index: number): { column: string; row: number; side: "top" | "left" | "right" } => {
    if (hasTop && index === 0) return { column: "1 / -1", row: 1, side: "top" };
    const rest = index - offset;
    return { column: rest % 2 === 0 ? "1" : "3", row: offset + Math.floor(rest / 2) + 1, side: rest % 2 === 0 ? "left" : "right" };
  };
  return <div className={`orbit ${dark ? "orbit--dark" : ""}`}>
    <div className="orbit__hubcell" style={{ "--orbit-row": `${offset + 1} / span ${pairs}` } as CSSProperties}>
      <OrbitHub count={items.length}>{logo ? <Image alt="" className="orbit__logo" height={80} src={logo.url} width={220} /> : <span className="orbit__wordmark">{brand}</span>}</OrbitHub>
    </div>
    {items.map((item, index) => {
      const slot = place(index);
      const photos = galleries[index];
      return <div className={`orbit__item orbit__item--${slot.side}`} data-builder-item={`items:${index}`} key={`${item.title}-${index}`} style={{ "--orbit-column": slot.column, "--orbit-row": slot.row } as CSSProperties}>
        <div className="orbit__text">
          <div className="orbit__head">
            <span aria-hidden="true" className="orbit__icon" data-builder-field="icon">{item.icon ? <BlockIcon name={item.icon} size={22} strokeWidth={1.8} /> : String(index + 1).padStart(2, "0")}</span>
            <h3 data-builder-field="title">{item.title}</h3>
          </div>
          {item.description ? <p data-builder-field="description">{item.description}</p> : null}
          {item.href ? <SiteLink className="orbit__more" data-builder-field="href" href={item.href}>{t("common.viewMore")}</SiteLink> : null}
        </div>
        {photos.length ? <div className="orbit__photo"><HeroImages builderItem={null} imageClassName="object-contain" images={photos.map(photo => ({ url: photo.url, alt: photo.altText ?? item.title }))} onLight={!dark} preload={false} sizes="200px" variant="cover" /></div> : null}
      </div>;
    })}
  </div>;
}
