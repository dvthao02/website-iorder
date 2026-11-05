import Image from "next/image";
import { resolveBlockFrames, type BlockFrame, type SectionSurface } from "@iorder/core/server/pages/block-layout";
import type { PageBlock } from "@iorder/core/server/pages/pages.contract";
import { getMediaById } from "@/lib/backend";
import { getPartners, getTestimonials } from "@/lib/backend";
import { ButtonLink, Card, CardText, CardTitle, FaqList, FrameSection, IconTile, MoreLink, SectionHeading, TextLink, accentClass, gridColumns } from "@/components/ui";
import { BlockIcon } from "./block-icon";
import { CollectionList } from "./collection-list";
import { HeroSection } from "./hero-section";
import { GroupedListSection, MediaTextSection, PricingSection } from "./section-blocks";
import { LeadForm } from "./lead-form";
import { RichContent } from "./rich-content";

// Vẽ các khối trang theo thứ tự CMS. Nền, khoảng cách và mã neo của mọi khối đi qua một quy luật chung
// (resolveBlockFrames: nền tự xen kẽ, khoảng cách chuẩn); giao diện từng khối dùng component nền @/components/ui.
// `previous`: nền của phần ngay phía trên khối đầu tiên (ví dụ phần đầu trang danh sách).
export async function PageBlockRenderer({ blocks, previous = null }: { blocks: PageBlock[]; previous?: SectionSurface | null }) {
  const enabled = blocks.filter(block => block.isEnabled);
  const frames = resolveBlockFrames(enabled, previous);
  return <>{await Promise.all(enabled.map(async (block, index) => <Block block={block} first={index === 0} frame={frames[index]} key={`${block.type}-${index}`} />))}</>;
}

type CardItem = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>["data"]["items"][number];

// Lưới thẻ: ô biểu tượng (hoặc số thứ tự khi thẻ chưa chọn biểu tượng), tiêu đề, mô tả, liên kết.
// Chỉ cần một thẻ có ảnh (mediaId) là cả lưới chuyển sang thẻ ảnh kiểu KiotViet/iPOS: ảnh ngang bo góc ở đầu thẻ;
// thẻ chưa có ảnh dùng mảng màu nhấn với biểu tượng lớn để lưới vẫn đều nhau trong lúc chờ ảnh.
async function CardGrid({ items, visual = false }: { items: CardItem[]; visual?: boolean }) {
  const photos = await Promise.all(items.map(async item => {
    const media = item.mediaId ? await getMediaById(item.mediaId) : null;
    return media?.mimeType.startsWith("image/") ? media : null;
  }));
  if (!visual && !photos.some(Boolean)) return <div className={`grid gap-5 ${gridColumns(items.length, 4)}`}>
    {items.map((item, index) => <Card href={item.href} key={`${item.title}-${index}`}>
      <span className="mb-5"><IconTile>{item.icon ? <BlockIcon name={item.icon} size={22} strokeWidth={1.8} /> : String(index + 1).padStart(2, "0")}</IconTile></span>
      <CardTitle>{item.title}</CardTitle>
      {item.description ? <CardText>{item.description}</CardText> : null}
      {item.href ? <MoreLink /> : null}
    </Card>)}
  </div>;
  return <div className={`grid gap-5 ${gridColumns(items.length, 4)}`}>
    {items.map((item, index) => {
      const photo = photos[index];
      return <Card flush href={item.href} key={`${item.title}-${index}`}>
        <div className={`relative w-full overflow-hidden bg-subtle ${photo ? "aspect-[16/10]" : "aspect-[16/5] sm:aspect-[16/10]"}`}>
          {photo ? <Image alt={photo.altText ?? item.title} className="object-cover transition duration-500 group-hover:scale-[1.03]" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" src={photo.url} />
            : <span aria-hidden="true" className={`absolute inset-0 grid place-items-center ${accentClass(index)}`}>{item.icon ? <BlockIcon name={item.icon} size={56} strokeWidth={1.4} /> : <span className="text-display font-bold">{String(index + 1).padStart(2, "0")}</span>}</span>}
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <CardTitle>{item.title}</CardTitle>
          {item.description ? <CardText>{item.description}</CardText> : null}
          {item.href ? <MoreLink /> : null}
        </div>
      </Card>;
    })}
  </div>;
}

// Các bước theo thứ tự: số lớn nối bằng đường kẻ (ngang trên máy tính, dọc trên điện thoại).
function ProcessSteps({ items }: { items: CardItem[] }) {
  return <ol className="relative m-0 grid list-none gap-8 p-0 md:grid-flow-col md:auto-cols-fr md:gap-6">
    {items.map((item, index) => <li className="relative pl-16 md:pt-16 md:pl-0" key={`${item.title}-${index}`}>
      <span aria-hidden className="absolute top-0 left-0 grid size-12 place-items-center rounded-full bg-brand-600 text-h3 font-bold text-white shadow-brand">{index + 1}</span>
      {index < items.length - 1 ? <span aria-hidden className="absolute top-12 bottom-[-2rem] left-6 w-px bg-brand-200 md:top-6 md:right-[-1.5rem] md:bottom-auto md:left-14 md:h-px md:w-auto" /> : null}
      <CardTitle>{item.title}</CardTitle>
      {item.description ? <CardText>{item.description}</CardText> : null}
      {item.href ? <TextLink className="mt-3 inline-block text-small font-bold text-brand-700 hover:underline" href={item.href}>Xem thêm →</TextLink> : null}
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

async function Block({ block, first, frame }: { block: PageBlock; first: boolean; frame: BlockFrame }) {
  const dark = frame.tone === "dark";
  switch (block.type) {
    case "hero": return <HeroSection data={block.data} first={first} />;
    case "media_text": return <MediaTextSection data={block.data} frame={frame} />;
    case "pricing": return <PricingSection data={block.data} frame={frame} />;
    case "grouped_list": return <GroupedListSection data={block.data} frame={frame} />;
    case "stats": return <FrameSection frame={frame}>
      <SectionHeading dark={dark} eyebrow={block.data.eyebrow} title={block.data.title} />
      <dl className="m-0 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{block.data.items.map((item, index) => <div className="border-l-2 border-brand-500 pl-5" key={`${item.label}-${index}`}>
        <dt className="sr-only">{item.label}</dt>
        <dd className={`m-0 text-display font-bold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{item.value}</dd>
        <dd className={`m-0 mt-2 text-body font-semibold ${dark ? "text-white/85" : "text-ink"}`}>{item.label}</dd>
        {item.note ? <dd className={`m-0 mt-1 text-small ${dark ? "text-white/60" : "text-muted"}`}>{item.note}</dd> : null}
      </div>)}</dl>
    </FrameSection>;
    case "features":
    case "industries":
    case "ecosystem": return <FrameSection frame={frame}>
      <SectionHeading dark={dark} description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
      <CardGrid items={block.data.items} visual={block.data.cardStyle === "visual"} />
    </FrameSection>;
    case "process": return <FrameSection frame={frame}>
      <SectionHeading description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
      <ProcessSteps items={block.data.items} />
    </FrameSection>;
    case "testimonials": {
      const testimonials = (await getTestimonials(true)).slice(0, block.data.limit);
      if (!testimonials.length) return null;
      return <FrameSection frame={frame}>
        <SectionHeading dark={dark} eyebrow={block.data.eyebrow} title={block.data.title} />
        <div className={`grid gap-5 ${gridColumns(testimonials.length)}`}>{testimonials.map(item => <Card as="figure" className="m-0" key={item.id}>
          {item.rating ? <p aria-label={`${item.rating} trên 5 sao`} className="mb-3 text-accent-amber">{"★".repeat(item.rating)}<span className="text-subtle">{"★".repeat(5 - item.rating)}</span></p> : <span aria-hidden className="mb-2 text-display leading-none font-black text-brand-200">“</span>}
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
      // Dải logo không khung, xám nhạt, hiện màu khi rê chuột (như dải logo khách hàng của Sapo/KiotViet); nền tối thì logo trắng.
      // Lưới ô cùng kích thước (logo nào cũng nằm gọn trong ô 40px cao × 120px rộng) và số cột chia đều số logo để hàng cuối không lẻ.
      return <FrameSection frame={frame}>
        <SectionHeading className="mb-8" dark={dark} eyebrow={block.data.eyebrow} size="sm" title={block.data.title} />
        <ul className={`m-0 grid list-none gap-x-6 gap-y-5 p-0 ${logoGridClass(partners.length)}`}>{partners.map(item => {
          const content = item.logo ? <Image alt={item.logo.altText ?? item.name} className={`max-h-10 w-auto max-w-[120px] object-contain opacity-70 transition group-hover:opacity-100 ${dark ? "brightness-0 invert" : "grayscale group-hover:grayscale-0"}`} height={96} src={item.logo.url} width={240} /> : <span className={`text-body font-semibold ${dark ? "text-white/80" : "text-muted"}`}>{item.name}</span>;
          const box = "group flex h-14 items-center justify-center";
          return <li key={item.id}>{item.websiteUrl ? <a aria-label={item.name} className={box} href={item.websiteUrl} rel="noopener noreferrer" target="_blank">{content}</a> : <div className={box}>{content}</div>}</li>;
        })}</ul>
      </FrameSection>;
    }
    case "faq": return <FrameSection frame={frame} width="narrow">
      <SectionHeading dark={dark} eyebrow={block.data.eyebrow} title={block.data.title} />
      <FaqList items={block.data.items} />
    </FrameSection>;
    case "cta": return <FrameSection frame={frame}>
      <div className="flex flex-col items-start justify-between gap-8 rounded-card bg-gradient-to-br from-brand-700 to-navy px-8 py-12 text-white shadow-raised sm:px-12 md:flex-row md:items-center">
        <SectionHeading align="left" className="" dark eyebrow={block.data.eyebrow} title={block.data.title} />
        <ButtonLink action={block.data.action} variant="light" />
      </div>
    </FrameSection>;
    case "lead_form": return <FrameSection frame={frame}><LeadForm {...block.data} dark={frame.tone === "dark"} /></FrameSection>;
    case "rich_text": return <FrameSection frame={frame} width="text">
      {block.data.heading ? <h2 className="mb-6 text-h2 font-bold tracking-tight text-ink">{block.data.heading}</h2> : null}
      {typeof block.data.body === "string" ? <div className="grid gap-5 text-lead text-ink/80">{block.data.body.split("\n").map((paragraph, index) => paragraph ? <p className="mb-0" key={index}>{paragraph}</p> : null)}</div> : <RichContent doc={block.data.body} />}
    </FrameSection>;
    case "image": {
      const media = await getMediaById(block.data.mediaId);
      return media?.mimeType.startsWith("image/") ? <FrameSection frame={frame}><figure className="m-0">
        <Image alt={block.data.alt ?? media.altText ?? ""} className="h-auto w-full rounded-card border border-line" height={800} sizes="(min-width: 1152px) 92vw, 100vw" src={media.url} width={1200} />
        {block.data.caption ? <figcaption className="mt-3 text-center text-small text-muted">{block.data.caption}</figcaption> : null}
      </figure></FrameSection> : null;
    }
    // featured_posts/download_list are kept for stored pages; both render as a collection_list.
    case "collection_list": return <CollectionList data={block.data} frame={frame} />;
    case "featured_posts": return <CollectionList data={{ source: "posts", eyebrow: block.data.eyebrow, title: block.data.title, description: null, limit: block.data.limit, anchor: null }} frame={frame} />;
    case "download_list": return <CollectionList data={{ source: "downloads", eyebrow: block.data.eyebrow, title: block.data.title, description: null, limit: null, anchor: null }} frame={frame} />;
    default: return null;
  }
}
