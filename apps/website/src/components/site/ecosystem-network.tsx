import { Network } from "lucide-react";
import type { CSSProperties } from "react";

import { Card, CardText, CardTitle, MoreLink } from "@/components/ui";
import type { BlockIcon as BlockIconName } from "@iorder/shared/server/shared/block-icons";
import { BlockIcon } from "./block-icon";
import { CoverPhoto, type CoverPhotoImage } from "./cover-photo";
import { getT } from "@/lib/messages";

type NetworkItem = { title: string; description: string; href?: string | null; icon?: BlockIconName | null; background?: string | null };
type NetworkPhoto = CoverPhotoImage[];

// Số cột theo cỡ màn hình: điện thoại 1 cột, máy tính bảng 2 cột, máy tính 3 cột (4 thẻ thì 2×2 cho cân đối; ít hơn 3 thẻ thì đúng số thẻ).
const columns = (count: number, wide: number) => Math.max(1, Math.min(count, wide));

/**
 * Hệ sinh thái dạng sơ đồ kết nối: một nút trung tâm "iOrder", đường kẻ rẽ nhánh xuống từng thẻ, các thẻ lại nối với thẻ bên cạnh
 * và thẻ bên dưới — thể hiện các phần liên thông và truyền dữ liệu cho nhau. Chấm sáng chạy dọc đường nối (CSS .eco-net trong globals.css).
 * Đường nối chỉ trang trí (aria-hidden); số cột và đoạn nối nào hiện do class theo từng cỡ màn hình (b = điện thoại, s = bảng, l = máy tính).
 */
export async function EcosystemNetwork({ items, photos }: { items: NetworkItem[]; photos: NetworkPhoto[] }) {
  const t = await getT();
  const count = items.length;
  const smallCols = columns(count, 2);
  const largeCols = count === 4 ? 2 : columns(count, 3);
  const flags = (index: number, cols: number, prefix: string) => [
    index < cols ? `${prefix}-first` : "",
    index + cols < count ? `${prefix}-below` : "",
    index % cols === cols - 1 || index === count - 1 ? `${prefix}-end` : "",
  ];
  return <div className="eco-net" style={{ "--eco-cols-s": smallCols, "--eco-cols-l": largeCols } as CSSProperties}>
    <div aria-hidden="true" className="eco-net__hub">
      <span className="eco-net__hub-node"><Network aria-hidden="true" size={20} strokeWidth={2.2} />iOrder</span>
    </div>
    <div aria-hidden="true" className="eco-net__spacer"><span className="eco-net__stem" /><span className="eco-net__bus" /></div>
    <ul className="eco-net__grid">{items.map((item, index) => {
      const photo = photos[index]?.length ? photos[index] : null;
      const classes = ["eco-net__cell", index === 0 ? "eco-b-first" : "", index + 1 < count ? "eco-b-below" : "", ...flags(index, smallCols, "eco-s"), ...flags(index, largeCols, "eco-l")].filter(Boolean).join(" ");
      return <li className={classes} key={`${item.title}-${index}`} style={{ "--eco-delay": `${(index * 0.45).toFixed(2)}s` } as CSSProperties}>
        <span aria-hidden="true" className="eco-link eco-link--up" />
        <Card background={item.background} flush href={item.href} item={`items:${index}`}>
          <div className={`relative w-full overflow-hidden bg-subtle ${photo ? "aspect-[16/10]" : "aspect-[16/6] sm:aspect-[16/10]"}`}>
            {photo ? <CoverPhoto alt={item.title} className="transition duration-500 group-hover:scale-[1.03]" fit="contain" photos={photo} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" />
              : <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">{item.icon ? <BlockIcon name={item.icon} size={52} strokeWidth={1.4} /> : <span className="text-display font-bold">{String(index + 1).padStart(2, "0")}</span>}</span>}
          </div>
          <div className="flex flex-1 flex-col p-5 sm:p-6">
            <CardTitle>{item.title}</CardTitle>
            {item.description ? <CardText>{item.description}</CardText> : null}
            {item.href ? <MoreLink>{t("common.more")}</MoreLink> : null}
          </div>
        </Card>
        <span aria-hidden="true" className="eco-link eco-link--right" />
        <span aria-hidden="true" className="eco-link eco-link--down" />
      </li>;
    })}</ul>
  </div>;
}
