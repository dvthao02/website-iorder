import { notFound } from "next/navigation";
import type { ResolvingMetadata } from "next";
import { contentMetadata } from "@/lib/page-metadata";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { DetailHero } from "@/components/site/detail-hero";
import { Section, SectionHeading } from "@/components/ui";
import { getEquipment, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { JsonLd } from "@/components/site/json-ld";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/structured-data";
export const revalidate = 0;
type Props = { params: Promise<{ slug: string }> };
const priceFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
export async function generateMetadata({ params }: Props, parent: ResolvingMetadata) {
  const { slug } = await params;
  const item = (await getEquipment(true)).find(row => row.slug === slug);
  return item ? contentMetadata({ title: `${item.seoTitle || item.name} | iOrder`, description: item.seoDescription || item.summary, path: `/thiet-bi/${item.slug}`, canonicalUrl: item.canonicalUrl, image: item.coverUrl ? { url: item.coverUrl, alt: item.coverAlt } : null }, parent) : { title: "Không tìm thấy thiết bị | iOrder" };
}
// Trang chi tiết thiết bị: phần đầu một màn hình (ảnh trong khung, giá, bảo hành, nút liên hệ) rồi thông số kỹ thuật theo nhóm.
export default async function EquipmentDetail({ params }: Props) {
  const { slug } = await params;
  const item = (await getEquipment(true)).find(row => row.slug === slug);
  if (!item) notFound();
  const [config, profile] = await Promise.all([getPublishingConfig(), getSiteProfile()]);
  const site = config.siteUrl;
  return <><SiteHeader />{site ? <JsonLd data={[productJsonLd(site, { name: item.name, description: item.seoDescription || item.summary, path: `/thiet-bi/${item.slug}`, imagePath: item.coverUrl ?? null, sku: item.modelCode, priceVnd: item.priceVnd, brand: profile?.companyName ?? "iOrder" }), breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, { name: "Thiết bị", path: "/thiet-bi" }, { name: item.name, path: `/thiet-bi/${item.slug}` }])]} /> : null}
    <main>
      <DetailHero back={{ href: "/thiet-bi", label: "Tất cả thiết bị" }} image={item.coverUrl ? { url: item.coverUrl, alt: item.coverAlt ?? item.name } : null} imageStyle="product" label={item.groupName} primary={{ label: "Liên hệ mua hàng", href: "/lien-he" }} secondary={{ label: "Xem thiết bị khác", href: "/thiet-bi" }} summary={item.summary} title={item.name}>
        <p className="mt-6 mb-0 text-3xl font-bold tracking-tight text-brand-700">{priceFormatter.format(item.priceVnd)}</p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {item.modelCode ? <li className="flex items-center gap-2"><BadgeCheck aria-hidden="true" className="text-brand-600" size={18} />Mã máy: <strong className="font-semibold text-ink">{item.modelCode}</strong></li> : null}
          <li className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="text-emerald-600" size={18} />Bảo hành <strong className="font-semibold text-ink">{item.warrantyMonths} tháng</strong></li>
        </ul>
      </DetailHero>
      {item.specificationGroups.length ? <Section tone="white">
        <SectionHeading eyebrow="Thông số" title="Thông số kỹ thuật" />
        <div className={`grid items-start gap-5 ${item.specificationGroups.length > 1 ? "lg:grid-cols-2" : "mx-auto max-w-3xl"}`}>{item.specificationGroups.map((group, index) => <section className="rounded-card border border-line bg-white p-6 shadow-card" key={index}>
          <h3 className="mb-4 text-h3 font-bold text-ink">{group.title}</h3>
          <dl className="m-0 divide-y divide-line">{group.items.map((spec, i) => {
            const importedFreeText = /^Thông tin \d+$/.test(spec.label);
            return <div className={`grid gap-1 py-3 ${importedFreeText ? "grid-cols-1" : "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4"}`} key={i}><dt className={importedFreeText ? "sr-only" : "text-muted"}>{importedFreeText ? `${group.title}: thông tin chi tiết` : spec.label}</dt><dd className="m-0 font-medium whitespace-pre-line text-ink">{spec.value}</dd></div>;
          })}</dl>
        </section>)}</div>
      </Section> : null}
    </main>
  </>;
}
