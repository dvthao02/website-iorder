import { visibleBlockItems } from "@iorder/shared/server/pages/visible-block-items";
import { ArrowRight, Quote } from "lucide-react";
import Image from "next/image";
import { Fragment, type CSSProperties } from "react";
import { SiteLink as Link } from "@/components/site/site-link";
import { blockUsesScreenHeight, resolveBlockFrames, type BlockFrame, type SectionSurface } from "@iorder/shared/server/pages/block-layout";
import type { PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { resolveSettingLinks } from "@iorder/shared/server/pages/setting-links";
import { isDarkColor } from "@iorder/shared/server/shared/color";
import { richTableOfContents } from "@iorder/shared/server/shared/rich-text";
import { youtubeVideoId } from "@iorder/shared/server/shared/youtube";
import { getMediaById } from "@/lib/backend";
import { getExternalLinks, getPartners, getSiteProfile, getTestimonials } from "@/lib/backend";
import { ButtonLink, Card, CardText, CardTitle, FaqList, FrameSection, IconTile, MoreLink, cardFlex, itemAlignClass, SectionHeading, TextLink, gridColumns } from "@/components/ui";
import { getT } from "@/lib/messages";
import { ArticleToc } from "./article-toc";
import { BlockIcon } from "./block-icon";
import { CollectionList } from "./collection-list";
import { EcosystemNetwork } from "./ecosystem-network";
import { HeroSection } from "./hero-section";
import { GroupedListSection, MediaTextSection, PricingSection, loadBlockImages } from "./section-blocks";
import { HeroImages } from "./hero-images";
import { CoverPhoto } from "./cover-photo";
import { ProcessStepper } from "./process-stepper";
import { EcosystemMosaic } from "./ecosystem-mosaic";
import { StoreSlider } from "./store-slider";
import { EcosystemOrbit } from "./ecosystem-orbit";
import { StoreGallery } from "./store-gallery";
import { DocumentCards } from "./document-cards";
import { ColumnsSection } from "./columns-section";
import { LeadForm } from "./lead-form";
import type { StaticPageProfile } from "@iorder/shared/server/pages/static-page-layout";
import { RichTableOfContents, RichContent } from "./rich-content";
import { YouTubeFrame } from "./youtube-frame";
import { getBuilderPreviewContext } from "@/lib/builder-preview";

// Vẽ các khối trang theo thứ tự CMS. Nền, khoảng cách và mã neo của mọi khối đi qua một quy luật chung
// (resolveBlockFrames: nền tự xen kẽ, khoảng cách chuẩn); giao diện từng khối dùng component nền @/components/ui.
// `previous`: nền của phần ngay phía trên khối đầu tiên (ví dụ phần đầu trang danh sách).
// Nút "theo Cài đặt" (`setting:trial`…) được đổi sang địa chỉ hiện tại trước khi vẽ.
// `screens` (tùy chọn, hiện chưa trang nào bật; trang chủ cao theo nội dung): trên máy tính mỗi phần cao tối thiểu một màn hình, nội dung căn giữa theo chiều dọc (CSS `.screen-block`);
// dải gọn (khoảng cách "Gọn", ví dụ logo đối tác) và phần đầu trang không áp dụng.
// Số liệu nổi bật: vạch nhấn nằm bên trái (căn trái), phía trên (căn giữa) hoặc bên phải (căn phải).
const statAlignClass = { left: "border-l-2 border-brand-500 pl-5", center: "border-t-2 border-brand-500 pt-4 text-center", right: "border-r-2 border-brand-500 pr-5 text-right" } as const;

export async function PageBlockRenderer({ blocks, previous = null, screens = false, sectionIds, staticPage }: { blocks: PageBlock[]; previous?: SectionSurface | null; screens?: boolean; sectionIds?: ReadonlyArray<string | undefined>; staticPage?: StaticPageProfile }) {
  const links = await getExternalLinks();
  const enabled = resolveSettingLinks(blocks.filter(block => block.isEnabled), links);
  const preview = await getBuilderPreviewContext();
  const original = preview?.document.kind === "page" ? preview.document.values.blocks : preview?.document.kind === "offering" ? preview.document.values.content.blocks ?? [] : preview?.document.kind === "equipment" ? preview.document.values.blocks ?? [] : [];
  const fingerprints = original.map(block => JSON.stringify(resolveSettingLinks(block, links)));
  const previewIndex = (block: PageBlock, index: number) => {
    const fingerprint = JSON.stringify(resolveSettingLinks(block, links));
    const occurrence = enabled.slice(0, index).filter(prior => JSON.stringify(resolveSettingLinks(prior, links)) === fingerprint).length;
    return fingerprints.flatMap((value, sourceIndex) => value === fingerprint ? [sourceIndex] : [])[occurrence];
  };
  // Ảnh nền chọn trong vỏ chung: đổi mã tệp sang địa chỉ ảnh (tệp đã xóa hoặc không phải ảnh thì bỏ ảnh nền).
  const frames = await Promise.all(resolveBlockFrames(enabled, previous).map(async (frame) => {
    if (!frame.background?.mediaId) return frame;
    const media = await getMediaById(frame.background.mediaId);
    return { ...frame, background: { ...frame.background, imageUrl: media?.mimeType.startsWith("image/") ? media.url : null } };
  }));
  // Hai phần liền nhau cùng nền trắng/xanh nhạt (chọn tay trong CMS): một vạch mảnh trong khung nội dung để mắt thấy chỗ chuyển phần,
  // thay vì bắt mọi phần đổi màu nền xen kẽ. Phần có màu hoặc ảnh nền riêng đã tự tách khỏi phần bên cạnh.
  const custom = (index: number) => Boolean(frames[index].background?.color || frames[index].background?.imageUrl);
  const divider = (index: number) => index > 0 && enabled[index - 1].type !== "hero" && frames[index].tone !== "dark" && frames[index].tone === frames[index - 1].tone && !custom(index) && !custom(index - 1);
  return <>{await Promise.all(enabled.map(async (block, index) => { const content = <Fragment key={`${block.type}-${index}`}>
    {divider(index) ? <div aria-hidden="true" className={frames[index].tone === "tinted" ? "bg-surface-tinted" : "bg-white"}><div className="site-container"><hr className="m-0 border-0 border-t border-line" /></div></div> : null}
    {preview && previewIndex(block, index) !== undefined ? <div data-builder-block={previewIndex(block, index)}>{blockUsesScreenHeight(block, screens) ? <div className="screen-block"><Block block={visibleBlockItems(block)} first={index === 0} frame={frames[index]} staticPage={staticPage} /></div> : <Block block={visibleBlockItems(block)} first={index === 0} frame={frames[index]} staticPage={staticPage} />}</div> : blockUsesScreenHeight(block, screens) ? <div className="screen-block"><Block block={visibleBlockItems(block)} first={index === 0} frame={frames[index]} staticPage={staticPage} /></div> : <Block block={visibleBlockItems(block)} first={index === 0} frame={frames[index]} staticPage={staticPage} />}
  </Fragment>; return sectionIds?.[index] ? <div data-static-section={index} data-testid="static-section" id={sectionIds[index]} key={`static-${index}`}>{content}</div> : content; }))}</>;
}

// Thẻ ảnh chưa có ảnh: mảng xanh thương hiệu nhạt + biểu tượng, cùng một tông cho cả lưới (không xoay màu nhấn để trang khỏi rối).
const photoFallback = "bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600";

type CardItem = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>["data"]["items"][number];

// Lưới thẻ: ô biểu tượng (hoặc số thứ tự khi thẻ chưa chọn biểu tượng), tiêu đề, mô tả, liên kết.
// Chỉ cần một thẻ có ảnh (mediaId) là cả lưới chuyển sang thẻ ảnh: ảnh ngang bo góc ở đầu thẻ;
// thẻ chưa có ảnh dùng mảng màu nhấn với biểu tượng lớn để lưới vẫn đều nhau trong lúc chờ ảnh.
async function CardGrid({ items, visual = false, bento = false, network = false }: { items: CardItem[]; visual?: boolean; bento?: boolean; network?: boolean }) {
  const t = await getT();
  // Mỗi thẻ có thể có nhiều ảnh (ảnh đầu + ảnh thêm); từ 2 ảnh thì thẻ tự chuyển ảnh.
  const galleries = await Promise.all(items.map(item => loadBlockImages([item.mediaId, ...(item.extraMediaIds ?? [])])));
  const photos = galleries.map(gallery => gallery[0] ?? null);
  // "Sơ đồ kết nối": nút trung tâm, đường nối giữa các thẻ có chấm sáng chạy (hệ sinh thái liên thông); cần từ 2 thẻ, ít hơn thì vẽ như lưới thường.
  if (network && items.length >= 2) return <EcosystemNetwork items={items} photos={galleries.map(gallery => gallery.map(photo => ({ url: photo.url, altText: photo.altText })))} />;
  // Máy tính: 3 cột (thẻ lớn ~36%, mỗi thẻ nhỏ ~32% — đủ rộng để chữ thẻ nhỏ không bị ép).
  // Bố cục "bento": thẻ đầu to bên trái chiếm hai hàng (ảnh lớn phía trên, chữ to phía dưới — cùng cấu trúc thẻ nhỏ nhưng nổi bật hơn),
  // bốn thẻ ảnh nhỏ xếp hai cột bên phải; đúng 5 thẻ mới đủ khít. Ảnh thẻ lớn để nguyên màu (không phủ tối) để mockup sản phẩm rõ.
  if (bento && items.length === 5) {
    const [lead, ...rest] = items;
    const leadPhoto = photos[0];
    const leadBody = <>
      <div className={`relative min-h-[14rem] flex-1 overflow-hidden lg:min-h-0 ${leadPhoto ? "bg-brand-50" : photoFallback}`}>
        {leadPhoto ? <CoverPhoto alt={lead.title} className="transition duration-700 group-hover:scale-[1.03]" fit="contain" photos={galleries[0]} sizes="(min-width: 1024px) 50vw, 100vw" />
          : <span aria-hidden="true" className="absolute inset-0 grid place-items-center">{lead.icon ? <BlockIcon name={lead.icon} size={72} strokeWidth={1.3} /> : null}</span>}
      </div>
      <div className="flex flex-col gap-3 border-t border-line p-6 lg:gap-2 lg:p-7">
        <h3 className="mb-0 text-h2 leading-tight font-bold tracking-tight text-balance text-ink" data-builder-field="title">{lead.title}</h3>
        {lead.description ? <span className="max-w-xl text-body text-muted" data-builder-field="description">{lead.description}</span> : null}
        {lead.href ? <span className="mt-1 text-small font-semibold text-brand-700 group-hover:underline">{t("common.viewDetail")}</span> : null}
      </div>
    </>;
    const leadClass = `group relative flex min-h-[26rem] flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:min-h-0 ${lead.background && isDarkColor(lead.background) ? "card-on-dark" : ""}`;
    const leadStyle = lead.background ? { backgroundColor: lead.background } : undefined;
    // Máy tính: hai hàng cao theo chiều cao màn (globals.css .bento-grid) để cả lưới vừa một màn hình ở mọi cỡ.
    return <div className="bento-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
      {lead.href ? <Link className={leadClass} data-builder-item="items:0" href={lead.href} style={leadStyle}>{leadBody}</Link> : <div className={leadClass} data-builder-item="items:0" style={leadStyle}>{leadBody}</div>}
      {rest.map((item, index) => {
        const photo = photos[index + 1];
        return <Card background={item.background} className="lg:flex-row" flush href={item.href} item={`items:${index + 1}`} key={`${item.title}-${index}`}>
          <div className={`relative w-full overflow-hidden bg-subtle lg:aspect-auto lg:w-[28%] lg:shrink-0 xl:w-[36%] ${photo ? "aspect-[16/9]" : "aspect-[16/5] sm:aspect-[16/9]"}`}>
            {photo ? <CoverPhoto alt={item.title} className="transition duration-500 group-hover:scale-[1.03]" fit="contain" photos={galleries[index + 1]} sizes="(min-width: 1024px) 12vw, 50vw" />
              : <span aria-hidden="true" className={`absolute inset-0 grid place-items-center ${photoFallback}`}>{item.icon ? <BlockIcon name={item.icon} size={40} strokeWidth={1.4} /> : null}</span>}
          </div>
          <div className="flex min-w-0 flex-1 flex-col p-5 lg:py-4">
            <CardTitle className="lg:text-body! xl:text-lead!">{item.title}</CardTitle>
            {item.description ? <CardText className="mt-2 line-clamp-3 shrink-0 text-small! lg:mt-1 lg:line-clamp-2">{item.description}</CardText> : null}
            {item.href ? <span className="mt-auto pt-5 text-small font-semibold text-brand-700 group-hover:underline lg:pt-2">{t("common.viewMore")}</span> : null}
          </div>
        </Card>;
      })}
    </div>;
  }
  if (!visual && !photos.some(Boolean)) {
    // Cả lưới chỉ có tiêu đề (chưa thẻ nào có mô tả): ô biểu tượng/số đứng cạnh tiêu đề trên một hàng cho gọn, thay vì ô phía trên rồi khoảng trống bên dưới.
    // Thẻ chọn căn giữa/phải hoặc "Biểu tượng phía trên" (mặc định khi thẻ có mô tả) giữ kiểu xếp dọc.
    const titlesOnly = !items.some(item => item.description);
    const layout = cardFlex(items.length, 4);
    return <div className={`card-flex ${layout.className}`.trim()} data-cols={layout.cols}>
      {items.map((item, index) => {
        const tile = <IconTile field="icon" tone="solid">{item.icon ? <BlockIcon name={item.icon} size={22} strokeWidth={1.8} /> : String(index + 1).padStart(2, "0")}</IconTile>;
        const text = <>
          <CardTitle>{item.title}</CardTitle>
          {item.description ? <CardText>{item.description}</CardText> : null}
          {item.href ? <MoreLink>{t("common.more")}</MoreLink> : null}
        </>;
        const inline = titlesOnly && !item.iconPosition && (item.align ?? "left") === "left";
        // "Biểu tượng bên trái": ô biểu tượng đứng cạnh khối chữ thay vì nằm phía trên.
        return <Card background={item.background} className={`feature-card ${itemAlignClass[item.align ?? "left"]}`} href={item.href} item={`items:${index}`} key={`${item.title}-${index}`}>
          {inline
            ? <div className="flex w-full items-center gap-4"><span className="shrink-0">{tile}</span><CardTitle className="min-w-0 flex-1">{item.title}</CardTitle>{item.href ? <ArrowRight aria-hidden="true" className="shrink-0 text-brand-600 transition group-hover:translate-x-0.5" data-builder-field="href" size={18} /> : null}</div>
            : item.iconPosition === "left" ? <div className="flex w-full items-start gap-4"><span className="shrink-0">{tile}</span><div className="flex min-w-0 flex-1 flex-col">{text}</div></div> : <><span className="mb-5">{tile}</span>{text}</>}
        </Card>;
      })}
    </div>;
  }
  // `data-card-grid`/`data-cols`: móc cho CSS trang chủ (lưới 4/2/1 cột theo màn hình, xem globals.css).
  return <div className={`grid gap-5 ${gridColumns(items.length, 4)}`} data-card-grid="cards" data-cols={items.length}>
    {items.map((item, index) => {
      const photo = photos[index];
      return <Card background={item.background} className={itemAlignClass[item.align ?? "left"]} flush href={item.href} item={`items:${index}`} key={`${item.title}-${index}`}>
        <div className={`relative w-full overflow-hidden bg-subtle ${photo ? "aspect-[16/10]" : "aspect-[16/5] sm:aspect-[16/10]"}`}>
          {photo ? <CoverPhoto alt={item.title} className="transition duration-500 group-hover:scale-[1.03]" fit="contain" photos={galleries[index]} sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" />
            : <span aria-hidden="true" className={`absolute inset-0 grid place-items-center ${photoFallback}`}>{item.icon ? <BlockIcon name={item.icon} size={56} strokeWidth={1.4} /> : <span className="text-display font-bold">{String(index + 1).padStart(2, "0")}</span>}</span>}
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <CardTitle>{item.title}</CardTitle>
          {item.description ? <CardText>{item.description}</CardText> : null}
          {item.href ? <MoreLink>{t("common.more")}</MoreLink> : null}
        </div>
      </Card>;
    })}
  </div>;
}

// Lưới thẻ trên nền tối (ví dụ "Vì sao chọn iOrder"): tiêu đề cột trái, các ý xếp 2 cột bên phải, ngăn bằng vạch mảnh,
// không đóng khung từng ý; khác hẳn nhịp "tiêu đề giữa + hàng thẻ" của các phần sáng. Điện thoại: một cột.
async function DarkFeatureList({ eyebrow, title, description, items }: { eyebrow: string | null; title: string; description: string | null; items: CardItem[] }) {
  const t = await getT();
  return <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
    <SectionHeading align="left" className="lg:sticky lg:top-28 lg:self-start" dark description={description} eyebrow={eyebrow} title={title} />
    <ul className="m-0 grid list-none gap-x-10 p-0 sm:grid-cols-2">{items.map((item, index) => <li className="border-t border-white/15 py-7" data-builder-item={`items:${index}`} key={`${item.title}-${index}`}>
      <span aria-hidden="true" className="mb-5 grid size-11 place-items-center rounded-control bg-brand-500/20 text-brand-200 ring-1 ring-white/10">{item.icon ? <BlockIcon name={item.icon} size={22} strokeWidth={1.8} /> : <span className="text-small font-bold">{String(index + 1).padStart(2, "0")}</span>}</span>
      <h3 className="mb-0 text-h3 font-bold tracking-tight text-white" data-builder-field="title">{item.title}</h3>
      {item.description ? <p className="mt-2 mb-0 text-body text-white/70" data-builder-field="description">{item.description}</p> : null}
      {item.href ? <TextLink className="mt-3 inline-block text-small font-bold text-white hover:underline" field="href" href={item.href}>{t("common.viewMore")}</TextLink> : null}
    </li>)}</ul>
  </div>;
}

// Các bước theo thứ tự: số lớn nối bằng đường kẻ (ngang trên máy tính, dọc trên điện thoại).
// Từ 5 bước trở lên, năm cột ở khổ máy tính bảng (768px) quá hẹp: chỉ xếp ngang từ 1024px, dưới đó giữ dạng dọc có đường nối như điện thoại.
// Hai bộ lớp viết nguyên chuỗi (md / lg) để trình quét Tailwind nhận ra.
async function ProcessSteps({ items, dark = false }: { items: CardItem[]; dark?: boolean }) {
  const t = await getT();
  const wide = items.length >= 5;
  return <ol className={`relative m-0 grid list-none gap-8 p-0 ${wide ? "lg:grid-flow-col lg:auto-cols-fr lg:gap-6" : "md:grid-flow-col md:auto-cols-fr md:gap-6"}`}>
    {items.map((item, index) => <li className={`relative pl-16 ${wide ? "lg:pt-16 lg:pl-0" : "md:pt-16 md:pl-0"}`} data-builder-item={`items:${index}`} key={`${item.title}-${index}`}>
      <span aria-hidden className={`absolute top-0 left-0 grid size-12 place-items-center rounded-full text-h3 font-bold shadow-brand ${dark ? "bg-white text-brand-700" : "bg-brand-600 text-white"}`}>{index + 1}</span>
      {index < items.length - 1 ? <span aria-hidden className={`absolute top-12 bottom-[-2rem] left-6 w-px ${wide ? "lg:top-6 lg:right-[-1.5rem] lg:bottom-auto lg:left-14 lg:h-px lg:w-auto" : "md:top-6 md:right-[-1.5rem] md:bottom-auto md:left-14 md:h-px md:w-auto"} ${dark ? "bg-white/25" : "bg-brand-200"}`} /> : null}
      <CardTitle className={dark ? "text-white!" : ""}>{item.title}</CardTitle>
      {item.description ? <CardText className={dark ? "mt-2 text-white/75!" : "mt-2"}>{item.description}</CardText> : null}
      {item.href ? <TextLink className={`mt-3 inline-block text-small font-bold hover:underline ${dark ? "text-white" : "text-brand-700"}`} field="href" href={item.href}>{t("common.viewMore")}</TextLink> : null}
    </li>)}
  </ol>;
}

// Số cột của dải logo: ít logo thì căn giữa theo số logo; nhiều thì chọn số cột chia hết (8, 6 hoặc 5) để các hàng đầy, không dư một hai logo lẻ.
function logoGridClass(count: number) {
  if (count <= 5) return "grid-cols-2 sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr";
  const columns = count % 8 === 0 ? "lg:grid-cols-8" : count % 6 === 0 ? "lg:grid-cols-6" : count % 5 === 0 ? "lg:grid-cols-5" : "lg:grid-cols-6";
  return `grid-cols-2 sm:grid-cols-4 ${columns}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]?.toUpperCase()).join("");
}

// Đầu phần kiểu chia đôi: tiêu đề bên trái, mô tả bên phải (thấp hơn tiêu đề căn giữa hai dòng + mô tả hai dòng) để cả phần vừa một màn hình.
// Dùng cho "Thẻ lớn nổi bật" (bento) và "Giấy tờ, chứng nhận" (document).
function SplitHeading({ dark, eyebrow, title, description }: { dark: boolean; eyebrow: string | null; title: string; description: string | null }) {
  return <div className="section-heading mb-10 grid gap-x-16 gap-y-4 sm:mb-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
    <SectionHeading align="left" className="" dark={dark} eyebrow={eyebrow} title={title} />
    {description ? <p className={`mb-0 text-lead ${dark ? "text-white/80" : "text-muted"}`} data-builder-field="description">{description}</p> : null}
  </div>;
}

async function Block({ block, first, frame: blockFrame, staticPage }: { block: PageBlock; first: boolean; frame: BlockFrame; staticPage?: StaticPageProfile }) {
  const t = await getT();
  // Khối đầu trang nằm ngay màn hình đầu tiên: ảnh nền của khung và ảnh nội dung tải ngay (không lazy) để không kéo chậm LCP.
  const frame = first ? { ...blockFrame, eager: true } : blockFrame;
  const dark = frame.tone === "dark";
  switch (block.type) {
    case "hero": return <HeroSection data={block.data} first={first} frame={frame} />;
    case "media_text": return <MediaTextSection data={block.data} first={first} frame={frame} />;
    case "pricing": return <PricingSection data={block.data} frame={frame} />;
    case "grouped_list": return <GroupedListSection data={block.data} frame={frame} />;
    case "columns": return <ColumnsSection data={block.data} first={first} frame={frame} />;
    case "stats": return <FrameSection frame={frame} glow>
      <SectionHeading dark={dark} eyebrow={block.data.eyebrow} title={block.data.title} />
      <dl className="m-0 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{block.data.items.map((item, index) => <div className={statAlignClass[item.align ?? "left"]} data-builder-item={`items:${index}`} key={`${item.label}-${index}`}>
        <dt className="sr-only">{item.label}</dt>
        <dd className={`m-0 text-display font-bold tracking-tight ${dark ? "text-white" : "text-ink"}`} data-builder-field="value">{item.value}</dd>
        <dd className={`m-0 mt-2 text-body font-semibold ${dark ? "text-white/85" : "text-ink"}`} data-builder-field="label">{item.label}</dd>
        {item.note ? <dd className={`m-0 mt-1 text-small ${dark ? "text-white/60" : "text-muted"}`} data-builder-field="note">{item.note}</dd> : null}
      </div>)}</dl>
    </FrameSection>;
    case "features":
    case "industries":
    case "ecosystem": if (block.data.cardStyle === "gallery") return <FrameSection frame={frame}>
      <SectionHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
      <StoreGallery first={first} items={block.data.items} />
    </FrameSection>;
    if (block.data.cardStyle === "document") return <FrameSection frame={frame}>
      <SplitHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
      <DocumentCards first={first} items={block.data.items} />
    </FrameSection>;
    if (block.data.cardStyle === "slider") return <FrameSection frame={frame}>
      <SectionHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
      <StoreSlider first={first} items={block.data.items} label={block.data.title} />
    </FrameSection>;
    if (block.data.cardStyle === "mosaic") return <FrameSection frame={frame}>
      <SectionHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
      <EcosystemMosaic first={first} items={block.data.items} />
    </FrameSection>;
    if (block.data.cardStyle === "orbit") return <FrameSection frame={frame}>
      <SectionHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
      <EcosystemOrbit dark={dark} items={block.data.items} />
    </FrameSection>;
    if (dark && !block.data.cardStyle?.match(/visual|bento|network/) && !block.data.items.some(item => item.mediaId)) return <FrameSection frame={frame} glow>
      <DarkFeatureList description={block.data.description} eyebrow={block.data.eyebrow} items={block.data.items} title={block.data.title} />
    </FrameSection>;
    return <FrameSection frame={frame}>
      {block.data.cardStyle === "bento" && block.data.items.length === 5
        // Bento: tiêu đề trái, mô tả phải (thấp hơn tiêu đề căn giữa hai dòng + mô tả hai dòng) để cả phần vừa một màn hình.
        ? <SplitHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
        : <SectionHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />}
      <CardGrid bento={block.data.cardStyle === "bento"} items={block.data.items} network={block.data.cardStyle === "network"} visual={block.data.cardStyle === "visual"} />
    </FrameSection>;
    case "process": return <FrameSection frame={frame}>
      {block.data.cardStyle === "stepper" ? null : <SectionHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />}
      {block.data.cardStyle === "stepper"
        ? <ProcessStepper dark={dark} heading={<SectionHeading align="left" className="" dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />} steps={await Promise.all(block.data.items.map(async item => ({ title: item.title, description: item.description, href: item.href, images: (await loadBlockImages([item.mediaId, ...(item.extraMediaIds ?? [])])).map(media => ({ url: media.url, alt: media.altText ?? item.title })) })))} />
        : <ProcessSteps dark={dark} items={block.data.items} />}
    </FrameSection>;
    case "testimonials": {
      const testimonials = (await getTestimonials(true)).slice(0, block.data.limit);
      if (!testimonials.length) return null;
      return <FrameSection frame={frame}>
        <SectionHeading dark={dark} eyebrow={block.data.eyebrow} title={block.data.title} />
        <div className={`grid gap-5 ${gridColumns(testimonials.length)}`} data-builder-field="limit">{testimonials.map(item => <Card as="figure" className="feature-card m-0" key={item.id}>
          {/* Hàng đầu thẻ: số sao (nếu có) bên trái, dấu trích dẫn mờ bên phải. */}
          <div className="mb-4 flex items-center justify-between gap-3">
            {item.rating ? <p aria-label={t("common.stars", { rating: item.rating })} className="mb-0 text-accent-amber">{"★".repeat(item.rating)}<span className="text-subtle">{"★".repeat(5 - item.rating)}</span></p> : <span />}
            <Quote aria-hidden="true" className="text-brand-200" fill="currentColor" size={28} strokeWidth={1.5} />
          </div>
          <blockquote className="m-0 flex-1 text-body text-ink/80">{item.quote}</blockquote>
          <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-5">
            {item.avatar ? <Image alt={item.avatar.altText ?? item.authorName} className="size-11 rounded-full object-cover" height={88} src={item.avatar.url} width={88} /> : <span aria-hidden className="grid size-11 place-items-center rounded-full bg-brand-100 text-small font-bold text-brand-700">{initials(item.authorName)}</span>}
            <span><strong className="block text-body text-ink">{item.authorName}</strong><span className="text-small text-muted">{[item.authorRole, item.company].filter(Boolean).join(", ")}</span></span>
          </figcaption>
        </Card>)}</div>
      </FrameSection>;
    }
    case "partners": {
      const partners = (await getPartners(true)).filter(item => block.data.kind === "all" || item.kind === block.data.kind).slice(0, block.data.limit);
      if (!partners.length) return null;
      // Dải logo không khung, luôn hiện đúng màu thương hiệu của từng logo không khung, các logo sát nhau (nhích to nhẹ khi rê chuột); nền tối thì logo trắng để đọc được.
      // Ít logo: lưới ô cùng kích thước (logo nằm gọn trong ô 40px cao × 120px rộng), số cột chia đều để hàng cuối không lẻ.
      // Từ 8 logo: một dải chạy ngang liên tục (bản sao thứ hai chỉ để nối vòng, ẩn với trình đọc màn hình và phím Tab);
      // dừng khi rê chuột/focus, bật giảm chuyển động thì thành hàng logo tĩnh xuống dòng (globals.css: .logo-marquee).
      const logo = (item: (typeof partners)[number], hidden = false) => {
        const content = item.logo ? <Image alt={hidden ? "" : item.logo.altText ?? item.name} className={`max-h-12 w-auto max-w-[150px] object-contain transition duration-200 group-hover:scale-105 ${dark ? "brightness-0 invert" : "mix-blend-multiply"}`} height={96} src={item.logo.url} width={240} /> : <span className={`text-body font-semibold whitespace-nowrap ${dark ? "text-white/80" : "text-muted"}`}>{item.name}</span>;
        const box = "group flex h-16 items-center justify-center";
        return item.websiteUrl ? <a aria-label={item.name} className={box} href={item.websiteUrl} rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined} target="_blank">{content}</a> : <div className={box}>{content}</div>;
      };
      const marquee = partners.length >= 8;
      return <FrameSection frame={frame}>
        <SectionHeading className="mb-8" dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} size="sm" title={block.data.title} />
        {marquee ? <div className="logo-marquee" data-builder-field="kind" style={{ "--marquee-duration": `${partners.length * 3.5}s` } as CSSProperties}>
          <div className="logo-marquee__track">
            <ul className="logo-marquee__list">{partners.map(item => <li key={item.id}>{logo(item)}</li>)}</ul>
            <ul aria-hidden="true" className="logo-marquee__list logo-marquee__list--clone">{partners.map(item => <li key={item.id}>{logo(item, true)}</li>)}</ul>
          </div>
        </div>
        : <ul className={`m-0 grid list-none gap-x-3 gap-y-3 p-0 ${logoGridClass(partners.length)}`}>{partners.map(item => <li key={item.id}>{logo(item)}</li>)}</ul>}
      </FrameSection>;
    }
    case "faq": return <FrameSection frame={frame}>
      <SectionHeading dark={dark} eyebrow={block.data.eyebrow} title={block.data.title} />
      <FaqList items={block.data.items} />
    </FrameSection>;
    case "cta": return <FrameSection frame={frame}>
      <div className="flex flex-col items-start justify-between gap-8 rounded-card bg-gradient-to-br from-brand-700 to-navy px-8 py-12 text-white shadow-raised sm:px-12 md:flex-row md:items-center">
        <SectionHeading align="left" className="" dark eyebrow={block.data.eyebrow} title={block.data.title} />
        <ButtonLink action={block.data.action} field="action" variant="light" />
      </div>
    </FrameSection>;
    case "lead_form": {
      const profile = await getSiteProfile();
      const contact = { hotline: profile?.hotline ?? null, email: profile?.salesEmail ?? profile?.supportEmail ?? null, workingHours: profile?.workingHours ?? null, address: staticPage === "contact" ? profile?.address ?? null : null };
      return <FrameSection frame={frame}><LeadForm {...block.data} contact={contact} dark={frame.tone === "dark"} trialUrl={(await getExternalLinks())?.trial ?? null} /></FrameSection>;
    }
    case "rich_text": {
      // Chính sách / điều khoản (hồ sơ "document") có mục lục: nội dung tối đa 56rem sát mép trái khung site, mục lục bám theo sát mép phải
      // (từ 1024px), cùng bề rộng với đầu trang và các phần khác như trang bài viết; điện thoại giữ hộp mục lục phía trên nội dung.
      const body = block.data.body;
      const toc = staticPage === "document" && typeof body !== "string" ? richTableOfContents(body) : [];
      if (toc.length >= 2 && typeof body !== "string") return <FrameSection frame={frame}>
        <div className="document-layout">
          <div className="document-layout__main">
            {block.data.heading ? <h2 className="mb-6 text-h2 font-bold tracking-tight text-ink" data-builder-field="title">{block.data.heading}</h2> : null}
            <div data-builder-field="body">
              <RichTableOfContents className="lg:hidden" doc={body} label={t("common.contentTocLabel")} title={t("common.contentTocTitle")} />
              <RichContent doc={body} />
            </div>
          </div>
          <aside aria-label={t("common.pageTocLabel")} className="document-layout__toc"><div className="document-layout__sticky"><ArticleToc entries={toc} label={t("common.contentTocLabel")} title={t("common.contentTocTitle")} /></div></aside>
        </div>
      </FrameSection>;
      return <FrameSection frame={frame} width="text">
      {block.data.heading ? <h2 className="mb-6 text-h2 font-bold tracking-tight text-ink" data-builder-field="title">{block.data.heading}</h2> : null}
      {typeof block.data.body === "string" ? <div className="grid gap-5 text-lead text-ink/80" data-builder-field="body">{block.data.body.split("\n").map((paragraph, index) => paragraph ? <p className="mb-0" key={index}>{paragraph}</p> : null)}</div> : <div data-builder-field="body">{staticPage === "document" ? <RichTableOfContents doc={block.data.body} label={t("common.contentTocLabel")} title={t("common.contentTocTitle")} /> : null}<RichContent doc={block.data.body} /></div>}
    </FrameSection>;
    }
    case "image": {
      const images = await loadBlockImages([block.data.mediaId, ...(block.data.extraMediaIds ?? [])]);
      const media = images[0];
      const imageClass = "h-auto w-full rounded-card border border-line";
      return media ? <FrameSection frame={frame}><figure className="m-0">
        {images.length > 1
          ? <HeroImages builderItem={null} imageClassName={imageClass} images={images.map(item => ({ url: item.url, alt: block.data.alt ?? item.altText ?? block.data.caption ?? "" }))} preload={first} sizes="(min-width: 1152px) 92vw, 100vw" variant="inline" />
          : <Image alt={block.data.alt ?? media.altText ?? block.data.caption ?? ""} className={imageClass} data-builder-field="image" fetchPriority={first ? "high" : undefined} height={800} loading={first ? "eager" : undefined} sizes="(min-width: 1152px) 92vw, 100vw" src={media.url} width={1200} />}
        {block.data.caption ? <figcaption className="mt-3 text-center text-small text-muted" data-builder-field="caption">{block.data.caption}</figcaption> : null}
      </figure></FrameSection> : null;
    }
    // Video YouTube 16:9 giữa khung (tối đa ~64rem); trên máy tính thu nhỏ theo chiều cao màn hình để cả phần vừa một màn.
    case "video": {
      const videoId = youtubeVideoId(block.data.url);
      if (!videoId) return null;
      return <FrameSection frame={frame}>
        <SectionHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
        <figure className="m-0 mx-auto w-full max-w-5xl lg:max-w-[min(64rem,calc((100svh-16rem)*16/9))]" data-builder-field="url">
          <YouTubeFrame className={`rounded-card shadow-raised ${dark ? "ring-1 ring-white/15" : "ring-1 ring-line"}`} title={block.data.title ?? block.data.caption ?? "Video YouTube"} videoId={videoId} />
          {block.data.caption ? <figcaption className={`mt-3 text-center text-small ${dark ? "text-white/70" : "text-muted"}`} data-builder-field="caption">{block.data.caption}</figcaption> : null}
        </figure>
      </FrameSection>;
    }
    // featured_posts/download_list are kept for stored pages; both render as a collection_list.
    case "collection_list": return <CollectionList data={block.data} frame={frame} />;
    case "featured_posts": return <CollectionList data={{ source: "posts", eyebrow: block.data.eyebrow, title: block.data.title, description: null, limit: block.data.limit, anchor: null }} frame={frame} />;
    case "download_list": return <CollectionList data={{ source: "downloads", eyebrow: block.data.eyebrow, title: block.data.title, description: null, limit: null, anchor: null }} frame={frame} />;
    default: return null;
  }
}
