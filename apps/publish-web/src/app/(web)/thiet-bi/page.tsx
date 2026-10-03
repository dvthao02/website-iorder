import Link from "next/link";
import Image from "next/image";
import { SiteHeader } from "@/components/site/site-header";
import { getEquipment } from "@/lib/backend";
import { getListingContent } from "@/lib/backend";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const content = await getListingContent(); return content ? { title: content.equipment.title, description: content.equipment.description ?? undefined } : {}; }
export default async function EquipmentPage() {
  const [items, content] = await Promise.all([getEquipment(true), getListingContent()]);
  if (!content) return <><SiteHeader /><main className="mx-auto max-w-6xl p-6">Nội dung trang thiết bị đang chờ được cấu hình trong CMS.</main></>;
  return <><SiteHeader /><main className="mx-auto max-w-6xl p-6"><p className="text-sm font-bold text-blue-700">{content.equipment.eyebrow}</p><h1 className="my-6 text-3xl font-bold">{content.equipment.title}</h1>{content.equipment.description ? <p className="mb-8 text-slate-600">{content.equipment.description}</p> : null}
    {!items.length ? <p>Chưa có thiết bị được xuất bản.</p> : <div className="grid gap-6 md:grid-cols-3">{items.map(item => <Link key={item.id} href={`/thiet-bi/${item.slug}`} className="rounded border p-5">
      {item.coverUrl ? <Image src={item.coverUrl} alt={item.coverAlt ?? item.name} width={600} height={400} className="h-auto w-full" /> : null}
      <p>{item.groupName}</p><h2 className="text-xl font-bold">{item.name}</h2><p>{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(item.priceVnd)}</p><p>{item.summary}</p>
    </Link>)}</div>}
  </main></>;
}
