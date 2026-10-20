import Image from "next/image";
import Link from "next/link";

import type { CollectionListData, CollectionSource } from "@iorder/core/server/pages/pages.contract";

import { getEnabledSupportDownloads, getEquipment, getPublishedOfferingSummaries, getPublishedPostSummaries } from "@/lib/backend";

const postTypeLabel = { announcement: "Thông báo", case_study: "Câu chuyện khách hàng", guide: "Hướng dẫn", news: "Tin tức", promotion: "Khuyến mãi" } as const;
const offeringPath = { software: "/phan-mem", solution: "/giai-phap", service: "/dich-vu" } as const;
const emptyMessages: Record<CollectionSource, string> = {
  posts: "Chưa có bài viết nào được xuất bản.",
  guides: "Chưa có bài viết hướng dẫn nào được xuất bản.",
  downloads: "Hiện chưa có tệp hỗ trợ nào.",
  equipment: "Chưa có thiết bị được xuất bản.",
  software: "Chưa có phần mềm nào được xuất bản.",
  solution: "Chưa có giải pháp nào được xuất bản.",
  service: "Chưa có dịch vụ nào được xuất bản.",
};
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const priceFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const cardClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md";

const take = <T,>(items: T[], limit: number | null) => (limit ? items.slice(0, limit) : items);

// Khối "Danh sách nội dung": dùng trên trang danh sách (/tin-tuc, /thiet-bi…) và mọi trang khác.
// Tiêu đề mặc định của site nằm trong @layer base nên class Tailwind trên từng tiêu đề luôn thắng.
// Khi khối không có tiêu đề (thường là ngay dưới phần đầu trang danh sách), thẻ dùng h2.
export async function CollectionList({ data }: { data: CollectionListData }) {
  const Card = data.title ? "h3" : "h2";
  const items = await renderItems(data, Card);
  return <section aria-label={data.title ?? undefined} className="mx-auto max-w-6xl scroll-mt-6 px-6 py-10 sm:py-12" id={data.anchor ?? undefined}>
    {data.title ? <div className="mb-6 max-w-3xl">
      {data.eyebrow ? <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">{data.eyebrow}</p> : null}
      <h2 className="mt-2 mb-0 text-2xl leading-tight font-extrabold tracking-tight text-slate-950">{data.title}</h2>
      {data.description ? <p className="mt-2 leading-7 text-slate-600">{data.description}</p> : null}
    </div> : null}
    {items ?? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">{emptyMessages[data.source]}</div>}
  </section>;
}

async function renderItems(data: CollectionListData, Card: "h2" | "h3") {
  switch (data.source) {
    case "posts": {
      const posts = take((await getPublishedPostSummaries()).filter(post => post.type !== "guide"), data.limit);
      return posts.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.map(post => <Link className={cardClass} href={`/tin-tuc/${post.slug}`} key={post.id}>
        <p className="mb-7 text-sm font-bold text-blue-700">{postTypeLabel[post.type]}</p>
        <Card className="mb-3 text-xl leading-snug font-extrabold tracking-tight text-slate-900">{post.title}</Card>
        {post.cover ? <Image alt={post.cover.altText ?? post.title} className="mb-4 h-auto w-full rounded-lg" height={338} src={post.cover.url} width={600} /> : null}
        {post.excerpt ? <p className="leading-7 text-slate-600">{post.excerpt}</p> : null}
        <p className="mt-6 text-sm font-medium text-slate-500">{dateFormatter.format(post.publishedAt ?? post.createdAt)}</p>
      </Link>)}</div> : null;
    }
    case "guides": {
      const guides = take(await getPublishedPostSummaries("guide"), data.limit);
      return guides.length ? <div className="grid gap-5 sm:grid-cols-2">{guides.map(guide => <Link className={cardClass} href={`/ho-tro/cai-dat/${guide.slug}`} key={guide.id}>
        <p className="mb-5 text-sm font-bold text-blue-700">{guide.categories[0]?.name ?? "Hướng dẫn iOrder"}</p>
        <Card className="mb-3 text-xl leading-snug font-extrabold tracking-tight text-slate-900">{guide.title}</Card>
        {guide.excerpt ? <p className="leading-7 text-slate-600">{guide.excerpt}</p> : null}
        <p className="mt-6 text-sm font-medium text-slate-500">{dateFormatter.format(guide.publishedAt ?? guide.createdAt)}</p>
      </Link>)}</div> : null;
    }
    case "downloads": {
      const downloads = take(await getEnabledSupportDownloads(), data.limit);
      return downloads.length ? <div aria-label="Tệp hỗ trợ để tải xuống" className="grid gap-4">{downloads.map(download => <article className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between" key={download.id}>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Tệp hỗ trợ</p>
          <Card className="mb-2 text-xl leading-snug font-extrabold tracking-tight text-slate-900">{download.title}</Card>
          {download.description ? <p className="leading-7 text-slate-600">{download.description}</p> : null}
          {download.meta ? <p className="mt-3 text-sm font-medium text-slate-500">{download.meta}</p> : null}
        </div>
        <a className="button button--primary shrink-0" download href={download.downloadUrl}>Tải xuống</a>
      </article>)}</div> : null;
    }
    case "equipment": {
      const equipment = take(await getEquipment(true), data.limit);
      return equipment.length ? <div className="grid gap-6 md:grid-cols-3">{equipment.map(item => <Link className={cardClass} href={`/thiet-bi/${item.slug}`} key={item.id}>
        {item.coverUrl ? <Image alt={item.coverAlt ?? item.name} className="mb-4 h-auto w-full rounded-lg" height={400} src={item.coverUrl} width={600} /> : null}
        <p className="text-sm font-bold text-blue-700">{item.groupName}</p>
        <Card className="mt-2 mb-0 text-xl leading-snug font-extrabold tracking-tight text-slate-900">{item.name}</Card>
        <p className="mt-2 font-bold text-slate-900">{priceFormatter.format(item.priceVnd)}</p>
        {item.summary ? <p className="mt-2 leading-7 text-slate-600">{item.summary}</p> : null}
      </Link>)}</div> : null;
    }
    case "software":
    case "solution":
    case "service": {
      const offerings = take(await getPublishedOfferingSummaries(data.source), data.limit);
      return offerings.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{offerings.map(offering => <Link className={cardClass} href={`${offeringPath[data.source as keyof typeof offeringPath]}/${offering.slug}`} key={offering.id}>
        {offering.cover ? <Image alt={offering.cover.altText ?? `Ảnh minh họa ${offering.title}`} className="mb-6 h-40 w-full rounded-xl object-cover" height={offering.cover.height ?? 630} src={offering.cover.url} width={offering.cover.width ?? 1200} /> : null}
        {offering.isFeatured ? <p className="mb-5 text-sm font-bold text-blue-700">Nổi bật</p> : null}
        <Card className="mb-3 text-xl leading-snug font-extrabold tracking-tight text-slate-900">{offering.title}</Card>
        {offering.summary ? <p className="leading-7 text-slate-600">{offering.summary}</p> : null}
        <p className="mt-6 text-sm font-bold text-blue-700">Xem chi tiết →</p>
      </Link>)}</div> : null;
    }
  }
}
