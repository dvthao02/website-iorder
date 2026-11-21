import type { ContentSeo } from "@iorder/shared/server/shared/content-seo";
import { contentSeoSchema } from "@iorder/shared/server/shared/content-seo";
import { getMediaById, getPublishingConfig } from "@/lib/backend";
import { JsonLd } from "./json-ld";
import { breadcrumbJsonLd, faqPageJsonLd, webPageJsonLd, type FaqItem, type WebPageKind } from "@/lib/structured-data";

type Node = Record<string, unknown>;
type ContentJsonLdProps = {
  seo?: ContentSeo;
  title: string;
  description?: string | null;
  path: string;
  defaults?: Node[];
  crumbs?: Array<{ name: string; path: string }>;
  /** Loại trang (Giới thiệu, Liên hệ, danh sách…) và ngày sửa cho nút WebPage tự động; bỏ qua khi truyền `defaults`. */
  kind?: WebPageKind;
  modifiedAt?: Date | null;
  /** Câu hỏi thường gặp đang hiện trên trang: tự thêm nút FAQPage (schema tùy chỉnh trong CMS thay thế phần tự động). */
  faq?: readonly FaqItem[];
};

export async function ContentJsonLd({ seo: input, title, description, path, defaults, crumbs = [], kind, modifiedAt, faq }: ContentJsonLdProps) {
  const seo = contentSeoSchema.parse(input ?? {});
  const config = await getPublishingConfig();
  const site = config.siteUrl;
  const canonical = site ? new URL(path, site).toString() : undefined;
  const faqNode = site && faq?.length ? faqPageJsonLd(site, path, faq) : null;
  const automatic = [...defaults ?? (site ? [webPageJsonLd(site, { kind, name: title, description: description ?? null, path, modifiedAt })] : []), ...faqNode ? [faqNode] : []];
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
