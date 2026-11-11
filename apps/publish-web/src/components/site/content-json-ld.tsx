import type { ContentSeo } from "@iorder/core/server/shared/content-seo";
import { contentSeoSchema } from "@iorder/core/server/shared/content-seo";
import { getMediaById, getPublishingConfig } from "@/lib/backend";
import { JsonLd } from "./json-ld";
import { breadcrumbJsonLd } from "@/lib/structured-data";

type Node = Record<string, unknown>;
export async function ContentJsonLd({ seo: input, title, description, path, defaults, crumbs = [] }: { seo?: ContentSeo; title: string; description?: string | null; path: string; defaults?: Node[]; crumbs?: Array<{ name: string; path: string }> }) {
  const seo = contentSeoSchema.parse(input ?? {});
  const config = await getPublishingConfig();
  const site = config.siteUrl;
  const canonical = site ? new URL(path, site).toString() : undefined;
  const automatic = defaults ?? (canonical ? [{ "@context": "https://schema.org", "@type": "WebPage", "@id": `${canonical}#webpage`, url: canonical, name: title, description: description ?? undefined }] : []);
  const content = seo.structuredData === undefined ? automatic.filter(node => node["@type"] !== "BreadcrumbList") : await Promise.all(seo.structuredData.map(async (document, index): Promise<Node> => {
    const url = document.url || canonical;
    const media = document.imageMediaId ? await getMediaById(document.imageMediaId) : null;
    const base: Node = { "@context": "https://schema.org", "@type": document.type, "@id": url ? `${url}#schema-${index + 1}` : undefined, url, name: document.name || title, description: document.description || description || undefined, image: media && site ? new URL(media.url, site).toString() : undefined };
    if (document.type === "Article") Object.assign(base, { headline: document.name || title, author: document.author ? { "@type": "Person", name: document.author } : undefined, mainEntityOfPage: url });
    if (document.type === "Product") Object.assign(base, { sku: document.sku || undefined, brand: document.brand ? { "@type": "Brand", name: document.brand } : undefined, offers: document.price === undefined ? undefined : { "@type": "Offer", price: document.price, priceCurrency: document.currency, url } });
    if (document.type === "FAQPage") base.mainEntity = document.questions?.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } }));
    return base;
  }));
  const breadcrumbs = seo.breadcrumbs === false ? [] : automatic.filter(node => node["@type"] === "BreadcrumbList");
  if (seo.breadcrumbs !== false && !breadcrumbs.length && site && crumbs.length) breadcrumbs.push(breadcrumbJsonLd(site, crumbs));
  const data = [...content, ...breadcrumbs];
  return data.length ? <JsonLd data={data} /> : null;
}
