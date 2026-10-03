import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { getEquipment } from "@/lib/backend";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const item = (await getEquipment(true)).find(row => row.slug === slug);
  return item ? { title: `${item.seoTitle || item.name} | iOrder`, description: item.seoDescription || item.summary, alternates: item.canonicalUrl ? { canonical: item.canonicalUrl } : undefined } : { title: "Không tìm thấy thiết bị" };
}
export default async function EquipmentDetail({ params }: Props) {
  const { slug } = await params;
  const item = (await getEquipment(true)).find(row => row.slug === slug);
  if (!item) notFound();
  return <><SiteHeader /><main className="mx-auto max-w-4xl p-6"><Link href="/thiet-bi">← Thiết bị</Link><h1 className="my-6 text-3xl font-bold">{item.name}</h1>
    {item.coverUrl ? <Image src={item.coverUrl} alt={item.coverAlt ?? item.name} width={1000} height={700} className="h-auto w-full" /> : null}
    <p>{item.groupName} · {item.modelCode}</p><p>{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(item.priceVnd)}</p><p>Bảo hành: {item.warrantyMonths} tháng</p><p>{item.summary}</p>
    {item.specificationGroups.map((group, index) => <section key={index} className="my-6"><h2 className="text-xl font-bold">{group.title}</h2><dl>{group.items.map((spec, i) => {
      const importedFreeText = /^Thông tin \d+$/.test(spec.label);
      return <div key={i} className={`grid border-b p-2 ${importedFreeText ? "grid-cols-1" : "grid-cols-2"}`}><dt className={importedFreeText ? "sr-only" : undefined}>{importedFreeText ? `${group.title}: thông tin chi tiết` : spec.label}</dt><dd>{spec.value}</dd></div>;
    })}</dl></section>)}
  </main></>;
}
