import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PageBlock } from "@iorder/core/server/pages/pages.contract";
import { getMediaById } from "@/lib/backend";
import { getPartners, getTestimonials } from "@/lib/backend";
import { CollectionList } from "./collection-list";
import { LeadForm } from "./lead-form";
import { RichContent } from "./rich-content";

export async function PageBlockRenderer({ blocks }: { blocks: PageBlock[] }) {
  return <>{await Promise.all(blocks.filter(block => block.isEnabled).map(async (block, index) => <Block block={block} first={index === 0} key={`${block.type}-${index}`} />))}</>;
}

type Action = { label: string; href: string } | null;
type CardItem = { title: string; description: string; href: string | null };

const container = "mx-auto max-w-6xl px-6";
const section = `${container} py-14 sm:py-20`;
const cardClass = "group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition";
const cardLinkClass = "hover:-translate-y-1 hover:border-blue-300 hover:shadow-md";
const isExternal = (href: string) => /^https?:\/\//i.test(href);

// Phần đầu của mỗi khối: dòng giới thiệu nhỏ, tiêu đề, mô tả.
function SectionHeading({ eyebrow, title, description, center }: { eyebrow?: string | null; title?: string | null; description?: string | null; center?: boolean }) {
  if (!eyebrow && !title && !description) return null;
  return <div className={center ? "mx-auto mb-10 max-w-3xl text-center" : "mb-10 max-w-3xl"}>
    {eyebrow ? <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{eyebrow}</p> : null}
    {title ? <h2 className="mt-3 mb-0 text-3xl leading-tight font-extrabold tracking-tight text-slate-950 sm:text-4xl">{title}</h2> : null}
    {description ? <p className="mt-4 text-lg leading-8 text-slate-600">{description}</p> : null}
  </div>;
}

function ActionLink({ action, variant }: { action: NonNullable<Action>; variant: "primary" | "secondary" | "light" }) {
  const className = variant === "primary" ? "button button--primary" : variant === "light" ? "button button--light" : "button border border-slate-300 bg-white text-slate-900 hover:border-slate-400";
  return isExternal(action.href)
    ? <a className={className} href={action.href} rel="noopener noreferrer" target="_blank">{action.label}</a>
    : <Link className={className} href={action.href}>{action.label}</Link>;
}

function Actions({ primary, secondary }: { primary: Action; secondary?: Action }) {
  if (!primary && !secondary) return null;
  return <div className="mt-8 flex flex-wrap gap-3">
    {primary ? <ActionLink action={primary} variant="primary" /> : null}
    {secondary ? <ActionLink action={secondary} variant="secondary" /> : null}
  </div>;
}

// Thẻ có liên kết thì cả thẻ bấm được; liên kết ngoài mở tab mới.
function CardShell({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <article className={cardClass}>{children}</article>;
  if (isExternal(href)) return <a className={`${cardClass} ${cardLinkClass}`} href={href} rel="noopener noreferrer" target="_blank">{children}</a>;
  return <Link className={`${cardClass} ${cardLinkClass}`} href={href}>{children}</Link>;
}

function CardGrid({ items, marker }: { items: CardItem[]; marker: "number" | "dot" }) {
  const columns = items.length === 2 || items.length === 4 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";
  return <div className={`grid gap-5 ${columns}`}>
    {items.map((item, index) => <CardShell href={item.href} key={`${item.title}-${index}`}>
      <span aria-hidden className="mb-5 grid size-10 place-items-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-700">{marker === "number" ? String(index + 1).padStart(2, "0") : "●"}</span>
      <h3 className="mb-2 text-xl leading-snug font-extrabold tracking-tight text-slate-900">{item.title}</h3>
      {item.description ? <p className="leading-7 whitespace-pre-line text-slate-600">{item.description}</p> : null}
      {item.href ? <span className="mt-auto pt-5 text-sm font-bold text-blue-700 group-hover:underline">Xem thêm →</span> : null}
    </CardShell>)}
  </div>;
}

// Các bước theo thứ tự: số lớn nối bằng đường kẻ (ngang trên máy tính, dọc trên điện thoại).
function ProcessSteps({ items }: { items: CardItem[] }) {
  return <ol className="relative grid gap-8 md:grid-flow-col md:auto-cols-fr md:gap-6">
    {items.map((item, index) => <li className="relative pl-16 md:pt-16 md:pl-0" key={`${item.title}-${index}`}>
      <span aria-hidden className="absolute top-0 left-0 grid size-12 place-items-center rounded-full bg-blue-600 text-lg font-extrabold text-white shadow-md shadow-blue-600/30">{index + 1}</span>
      {index < items.length - 1 ? <span aria-hidden className="absolute top-12 bottom-[-2rem] left-6 w-px bg-blue-200 md:top-6 md:right-[-1.5rem] md:bottom-auto md:left-14 md:h-px md:w-auto" /> : null}
      <h3 className="mb-2 text-lg font-extrabold text-slate-900">{item.title}</h3>
      {item.description ? <p className="leading-7 whitespace-pre-line text-slate-600">{item.description}</p> : null}
      {item.href ? <Link className="mt-3 inline-block text-sm font-bold text-blue-700 hover:underline" href={item.href}>Xem thêm →</Link> : null}
    </li>)}
  </ol>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]?.toUpperCase()).join("");
}

async function Block({ block, first }: { block: PageBlock; first: boolean }) {
  switch (block.type) {
    case "hero": {
      const media = block.data.mediaId ? await getMediaById(block.data.mediaId) : null;
      const image = media?.mimeType.startsWith("image/") ? media : null;
      return <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-blue-50/70 to-white">
        <div className={`${container} grid items-center gap-12 py-16 sm:py-24 ${image ? "lg:grid-cols-[1.05fr_1fr]" : ""}`}>
          <div className={image ? "" : "max-w-3xl"}>
            {block.data.eyebrow ? <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{block.data.eyebrow}</p> : null}
            {first ? <h1 className="mb-0 text-4xl leading-[1.1] font-extrabold tracking-tight text-slate-950 sm:text-6xl">{block.data.title}</h1> : <h2 className="mb-0 text-4xl leading-tight font-extrabold tracking-tight text-slate-950 sm:text-5xl">{block.data.title}</h2>}
            {block.data.description ? <p className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl">{block.data.description}</p> : null}
            <Actions primary={block.data.primaryAction} secondary={block.data.secondaryAction} />
          </div>
          {image ? <Image alt={image.altText ?? ""} className="h-auto w-full rounded-3xl border border-slate-200 shadow-xl shadow-slate-900/10" height={800} priority={first} sizes="(min-width: 1024px) 560px, 100vw" src={image.url} width={1200} /> : null}
        </div>
      </section>;
    }
    case "stats": return <section className="bg-slate-950 text-white"><div className={section}>
      {block.data.eyebrow ? <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-300">{block.data.eyebrow}</p> : null}
      {block.data.title ? <h2 className="mt-3 mb-10 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{block.data.title}</h2> : null}
      <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{block.data.items.map((item, index) => <div className="border-l-2 border-blue-500 pl-5" key={`${item.label}-${index}`}>
        <dt className="sr-only">{item.label}</dt>
        <dd className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{item.value}</dd>
        <dd className="mt-2 font-semibold text-slate-200">{item.label}</dd>
        {item.note ? <dd className="mt-1 text-sm text-slate-400">{item.note}</dd> : null}
      </div>)}</dl>
    </div></section>;
    case "features":
    case "industries":
    case "ecosystem": return <section className={block.type === "ecosystem" ? "bg-slate-50" : ""}><div className={section}>
      <SectionHeading description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
      <CardGrid items={block.data.items} marker={block.type === "features" ? "number" : "dot"} />
    </div></section>;
    case "process": return <section className="bg-slate-50"><div className={section}>
      <SectionHeading description={block.data.description} eyebrow={block.data.eyebrow} title={block.data.title} />
      <ProcessSteps items={block.data.items} />
    </div></section>;
    case "testimonials": {
      const testimonials = (await getTestimonials(true)).slice(0, block.data.limit);
      if (!testimonials.length) return null;
      return <section className={section}>
        <SectionHeading center eyebrow={block.data.eyebrow} title={block.data.title} />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{testimonials.map(item => <figure className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" key={item.id}>
          {item.rating ? <p aria-label={`${item.rating} trên 5 sao`} className="mb-3 text-amber-400">{"★".repeat(item.rating)}<span className="text-slate-200">{"★".repeat(5 - item.rating)}</span></p> : <span aria-hidden className="mb-2 text-5xl leading-none font-black text-blue-200">“</span>}
          <blockquote className="flex-1 leading-7 text-slate-700">{item.quote}</blockquote>
          <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
            {item.avatar ? <Image alt={item.avatar.altText ?? item.authorName} className="size-11 rounded-full object-cover" height={88} src={item.avatar.url} width={88} /> : <span aria-hidden className="grid size-11 place-items-center rounded-full bg-blue-100 text-sm font-extrabold text-blue-700">{initials(item.authorName)}</span>}
            <span><strong className="block text-slate-900">{item.authorName}</strong><span className="text-sm text-slate-500">{[item.authorRole, item.company].filter(Boolean).join(", ")}</span></span>
          </figcaption>
        </figure>)}</div>
      </section>;
    }
    case "partners": {
      const partners = (await getPartners(true)).filter(item => block.data.kind === "all" || item.kind === block.data.kind).slice(0, block.data.limit);
      if (!partners.length) return null;
      return <section className={section}>
        <SectionHeading center eyebrow={block.data.eyebrow} title={block.data.title} />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{partners.map(item => {
          const content = item.logo ? <Image alt={item.logo.altText ?? item.name} className="max-h-14 w-auto object-contain opacity-70 grayscale transition group-hover:opacity-100 group-hover:grayscale-0" height={112} src={item.logo.url} width={240} /> : <span className="font-bold text-slate-600">{item.name}</span>;
          const box = "group flex h-24 items-center justify-center rounded-2xl border border-slate-200 bg-white p-4";
          return <li key={item.id}>{item.websiteUrl ? <a aria-label={item.name} className={`${box} transition hover:border-blue-300`} href={item.websiteUrl} rel="noopener noreferrer" target="_blank">{content}</a> : <div className={box}>{content}</div>}</li>;
        })}</ul>
      </section>;
    }
    case "faq": return <section className={`${container} max-w-4xl py-14 sm:py-20`}>
      <SectionHeading center eyebrow={block.data.eyebrow} title={block.data.title} />
      <div className="grid gap-3">{block.data.items.map((item, index) => <details className="group rounded-2xl border border-slate-200 bg-white px-6 py-1 shadow-sm open:border-blue-200" key={`${item.question}-${index}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-bold text-slate-900 [&::-webkit-details-marker]:hidden">{item.question}<span aria-hidden className="text-2xl leading-none text-blue-700 transition group-open:rotate-45">+</span></summary>
        <p className="pb-5 leading-7 whitespace-pre-line text-slate-600">{item.answer}</p>
      </details>)}</div>
    </section>;
    case "cta": return <section className={`${container} py-10 sm:py-14`} id={block.data.id ?? undefined}>
      <div className="flex flex-col items-start justify-between gap-8 rounded-3xl bg-slate-950 px-8 py-12 text-white sm:px-12 md:flex-row md:items-center">
        <div className="max-w-2xl">
          {block.data.eyebrow ? <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-300">{block.data.eyebrow}</p> : null}
          <h2 className="mt-3 mb-0 text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-4xl">{block.data.title}</h2>
        </div>
        <ActionLink action={block.data.action} variant="light" />
      </div>
    </section>;
    case "lead_form": return <LeadForm {...block.data} />;
    case "rich_text": return <section className={`${container} max-w-3xl py-12 sm:py-16`}>
      {block.data.heading ? <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-slate-950">{block.data.heading}</h2> : null}
      {typeof block.data.body === "string" ? <div className="grid gap-5 text-lg leading-8 text-slate-700">{block.data.body.split("\n").map((paragraph, index) => paragraph ? <p key={index}>{paragraph}</p> : null)}</div> : <RichContent doc={block.data.body} />}
    </section>;
    case "image": {
      const media = await getMediaById(block.data.mediaId);
      return media?.mimeType.startsWith("image/") ? <figure className={`${container} py-10`}>
        <Image alt={block.data.alt ?? media.altText ?? ""} className="h-auto w-full rounded-3xl border border-slate-200" height={800} sizes="(min-width: 1152px) 1104px, 100vw" src={media.url} width={1200} />
        {block.data.caption ? <figcaption className="mt-3 text-center text-sm text-slate-500">{block.data.caption}</figcaption> : null}
      </figure> : null;
    }
    // featured_posts/download_list are kept for stored pages; both render as a collection_list.
    case "collection_list": return <CollectionList data={block.data} />;
    case "featured_posts": return <CollectionList data={{ source: "posts", eyebrow: block.data.eyebrow, title: block.data.title, description: null, limit: block.data.limit, anchor: null }} />;
    case "download_list": return <CollectionList data={{ source: "downloads", eyebrow: block.data.eyebrow, title: block.data.title, description: null, limit: null, anchor: null }} />;
    default: return null;
  }
}
