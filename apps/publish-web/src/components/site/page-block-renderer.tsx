import Image from "next/image";
import Link from "next/link";
import type { PageBlock } from "@iorder/core/server/pages/pages.contract";
import { getMediaById } from "@/lib/backend";
import { getPublishedPostSummaries } from "@/lib/backend";
import { getEnabledSupportDownloads } from "@/lib/backend";
import { getPartners, getTestimonials } from "@/lib/backend";
import { LeadForm } from "./lead-form";

export async function PageBlockRenderer({ blocks }: { blocks: PageBlock[] }) {
  return <>{await Promise.all(blocks.filter(block => block.isEnabled).map(async (block, index) => <Block block={block} key={`${block.type}-${index}`} />))}</>;
}

async function Block({ block }: { block: PageBlock }) {
  const section = "mx-auto max-w-6xl px-6 py-12 sm:py-16";
  if (block.type === "hero") return <section className={`${section} bg-slate-50`}><p>{block.data.eyebrow}</p><h1 className="text-4xl font-extrabold">{block.data.title}</h1>{block.data.description ? <p>{block.data.description}</p> : null}<Actions actions={[block.data.primaryAction, block.data.secondaryAction]} /></section>;
  if (block.type === "stats") return <section className={section}><p>{block.data.eyebrow}</p>{block.data.title ? <h2 className="text-3xl font-bold">{block.data.title}</h2> : null}<div className="grid gap-4 md:grid-cols-3">{block.data.items.map(item => <article key={item.label}><strong>{item.value}</strong><p>{item.label}</p>{item.note ? <small>{item.note}</small> : null}</article>)}</div></section>;
  if (block.type === "features" || block.type === "industries" || block.type === "ecosystem" || block.type === "process") return <section className={section}><p>{block.data.eyebrow}</p><h2 className="text-3xl font-bold">{block.data.title}</h2>{block.data.description ? <p>{block.data.description}</p> : null}<div className="grid gap-5 md:grid-cols-3">{block.data.items.map(item => <article key={item.title} className="rounded border p-5"><h3 className="font-bold">{item.title}</h3><p>{item.description}</p>{item.href ? <Link href={item.href}>Xem thêm</Link> : null}</article>)}</div></section>;
  if (block.type === "testimonials") { const testimonials = (await getTestimonials(true)).slice(0, block.data.limit); return <section className={section}><p>{block.data.eyebrow}</p><h2 className="text-3xl font-bold">{block.data.title}</h2>{testimonials.map(item => <blockquote key={item.id}><p>“{item.quote}”</p><footer>{item.authorName}{item.authorRole ? ` — ${item.authorRole}` : ""}{item.company ? `, ${item.company}` : ""}</footer></blockquote>)}</section>; }
  if (block.type === "partners") { const partners = (await getPartners(true)).filter(item => block.data.kind === "all" || item.kind === block.data.kind).slice(0, block.data.limit); return <section className={section}><p>{block.data.eyebrow}</p><h2 className="text-3xl font-bold">{block.data.title}</h2><div className="grid gap-4 md:grid-cols-4">{partners.map(item => item.websiteUrl ? <a href={item.websiteUrl} key={item.id} target="_blank" rel="noreferrer">{item.logo ? <Image src={item.logo.url} alt={item.logo.altText ?? item.name} width={240} height={120} /> : item.name}</a> : <div key={item.id}>{item.logo ? <Image src={item.logo.url} alt={item.logo.altText ?? item.name} width={240} height={120} /> : item.name}</div>)}</div></section>; }
  if (block.type === "faq") return <section className={section}><p>{block.data.eyebrow}</p><h2 className="text-3xl font-bold">{block.data.title}</h2>{block.data.items.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>;
  if (block.type === "cta") return <section id={block.data.id ?? undefined} className={`${section} bg-slate-900 text-white`}><p>{block.data.eyebrow}</p><h2 className="text-3xl font-bold">{block.data.title}</h2><Actions actions={[block.data.action]} /></section>;
  if (block.type === "lead_form") return <LeadForm {...block.data} />;
  if (block.type === "rich_text") return <section className={section}>{block.data.heading ? <h2 className="text-3xl font-bold">{block.data.heading}</h2> : null}{block.data.body.split("\n").map((paragraph, index) => paragraph ? <p key={index}>{paragraph}</p> : null)}</section>;
  if (block.type === "image") { const media = await getMediaById(block.data.mediaId); return media?.mimeType.startsWith("image/") ? <figure className={section}><Image src={media.url} alt={block.data.alt ?? media.altText ?? ""} width={1200} height={800} className="h-auto w-full" />{block.data.caption ? <figcaption>{block.data.caption}</figcaption> : null}</figure> : null; }
  if (block.type === "featured_posts") { const posts = (await getPublishedPostSummaries()).slice(0, block.data.limit); return <section className={section}><p>{block.data.eyebrow}</p><h2 className="text-3xl font-bold">{block.data.title}</h2>{posts.map(post => <Link key={post.id} href={post.type === "guide" ? `/ho-tro/cai-dat/${post.slug}` : `/tin-tuc/${post.slug}`}><article><h3>{post.title}</h3><p>{post.excerpt}</p></article></Link>)}</section>; }
  const downloads = await getEnabledSupportDownloads();
  return <section className={section}><p>{block.data.eyebrow}</p><h2 className="text-3xl font-bold">{block.data.title}</h2>{downloads.map(download => <a href={download.downloadUrl} key={download.id}>{download.title}</a>)}</section>;
}

function Actions({ actions }: { actions: Array<{ label: string; href: string } | null> }) { return <div className="flex gap-3">{actions.filter((action): action is { label: string; href: string } => Boolean(action)).map(action => <Link key={action.href} href={action.href}>{action.label}</Link>)}</div>; }
