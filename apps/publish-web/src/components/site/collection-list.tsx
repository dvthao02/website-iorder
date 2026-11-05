import Image from "next/image";
import Link from "next/link";

import type { BlockFrame } from "@iorder/core/server/pages/block-layout";
import type { CollectionListData, CollectionSource } from "@iorder/core/server/pages/pages.contract";

import { FrameSection, SectionHeading } from "@/components/ui";
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
// Thẻ kiểu KiotViet: ảnh trên cùng bo góc trong khung, nhãn dạng chip, liên kết cuối thẻ luôn nằm sát đáy.
const cardClass = "group flex h-full flex-col rounded-card border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised sm:p-5";
const chipClass = "inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-caption font-semibold text-brand-700";
const titleClass = "mb-0 text-h3 font-bold tracking-tight text-ink";
const textClass = "mt-2 mb-0 text-body text-muted";
const metaClass = "mt-auto mb-0 pt-5 text-small text-faint";
const moreClass = "mt-auto mb-0 pt-5 text-small font-semibold text-brand-700 group-hover:underline";

const take = <T,>(items: T[], limit: number | null) => (limit ? items.slice(0, limit) : items);

// Khối "Danh sách nội dung": dùng trên trang danh sách (/tin-tuc, /thiet-bi…) và mọi trang khác.
// Tiêu đề mặc định của site nằm trong @layer base nên class Tailwind trên từng tiêu đề luôn thắng.
// Khi khối không có tiêu đề (thường là ngay dưới phần đầu trang danh sách), thẻ dùng h2.
export async function CollectionList({ data, frame }: { data: CollectionListData; frame: BlockFrame }) {
  const Card = data.title ? "h3" : "h2";
  const items = await renderItems(data, Card);
  return <FrameSection frame={frame} label={data.title ?? undefined}>
    {data.title ? <SectionHeading dark={frame.tone === "dark"} description={data.description} eyebrow={data.eyebrow} title={data.title} /> : null}
    {items ?? <div className="rounded-card border border-dashed border-line bg-white p-8 text-body text-muted">{emptyMessages[data.source]}</div>}
  </FrameSection>;
}

async function renderItems(data: CollectionListData, Card: "h2" | "h3") {
  switch (data.source) {
    case "posts": {
      const posts = take((await getPublishedPostSummaries()).filter(post => post.type !== "guide"), data.limit);
      return posts.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.map(post => <Link className={cardClass} href={`/tin-tuc/${post.slug}`} key={post.id}>
        {post.cover ? <Image alt={post.cover.altText ?? post.title} className="mb-5 aspect-[16/9] w-full rounded-control bg-subtle object-cover" height={338} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" src={post.cover.url} width={600} /> : null}
        <p className={`mb-3 ${chipClass}`}>{postTypeLabel[post.type]}</p>
        <Card className={`${titleClass} line-clamp-2`}>{post.title}</Card>
        {post.excerpt ? <p className={`${textClass} line-clamp-3`}>{post.excerpt}</p> : null}
        <p className={metaClass}>{dateFormatter.format(post.publishedAt ?? post.createdAt)}</p>
      </Link>)}</div> : null;
    }
    case "guides": {
      const guides = take(await getPublishedPostSummaries("guide"), data.limit);
      return guides.length ? <div className="grid gap-5 sm:grid-cols-2">{guides.map(guide => <Link className={cardClass} href={`/ho-tro/huong-dan/${guide.slug}`} key={guide.id}>
        <p className={`mb-3 ${chipClass}`}>{guide.categories[0]?.name ?? "Hướng dẫn iOrder"}</p>
        <Card className={titleClass}>{guide.title}</Card>
        {guide.excerpt ? <p className={textClass}>{guide.excerpt}</p> : null}
        <p className={metaClass}>{dateFormatter.format(guide.publishedAt ?? guide.createdAt)}</p>
      </Link>)}</div> : null;
    }
    case "downloads": {
      const downloads = take(await getEnabledSupportDownloads(), data.limit);
      return downloads.length ? <div aria-label="Tệp hỗ trợ để tải xuống" className="grid gap-4">{downloads.map(download => <article className="flex flex-col gap-5 rounded-card border border-line bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between" key={download.id}>
        <div>
          <p className={`mb-3 ${chipClass}`}>Tệp hỗ trợ</p>
          <Card className={`mb-2 ${titleClass}`}>{download.title}</Card>
          {download.description ? <p className="mb-0 text-body text-muted">{download.description}</p> : null}
          {download.meta ? <p className="mt-3 mb-0 text-small font-medium text-faint">{download.meta}</p> : null}
        </div>
        <a className="button button--primary shrink-0" download href={download.downloadUrl}>Tải xuống</a>
      </article>)}</div> : null;
    }
    case "equipment": {
      const equipment = take(await getEquipment(true), data.limit);
      // Ảnh thiết bị cùng khung 4:3 nền nhạt (ảnh nền trong suốt vẫn đều nhau); 4 cột trên màn rộng.
      return equipment.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{equipment.map(item => <Link className={cardClass} href={`/thiet-bi/${item.slug}`} key={item.id}>
        {item.coverUrl ? <Image alt={item.coverAlt ?? item.name} className="mb-5 aspect-[4/3] w-full rounded-control bg-subtle object-contain p-2" height={450} sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" src={item.coverUrl} width={600} /> : null}
        <p className={`mb-2 ${chipClass}`}>{item.groupName}</p>
        <Card className={titleClass}>{item.name}</Card>
        {item.summary ? <p className={`${textClass} line-clamp-3`}>{item.summary}</p> : null}
        <p className="mt-auto mb-0 pt-4 text-h3 font-bold text-brand-700">{priceFormatter.format(item.priceVnd)}</p>
      </Link>)}</div> : null;
    }
    case "software":
    case "solution":
    case "service": {
      const offerings = take(await getPublishedOfferingSummaries(data.source), data.limit);
      return offerings.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{offerings.map(offering => <Link className={cardClass} href={`${offeringPath[data.source as keyof typeof offeringPath]}/${offering.slug}`} key={offering.id}>
        {offering.cover ? <Image alt={offering.cover.altText ?? `Ảnh minh họa ${offering.title}`} className="mb-5 aspect-[16/10] w-full rounded-control bg-brand-50 object-cover" height={offering.cover.height ?? 630} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" src={offering.cover.url} width={offering.cover.width ?? 1200} /> : null}
        {offering.isFeatured ? <p className={`mb-3 ${chipClass}`}>Nổi bật</p> : null}
        <Card className={titleClass}>{offering.title}</Card>
        {offering.summary ? <p className={textClass}>{offering.summary}</p> : null}
        <p className={moreClass}>Xem chi tiết →</p>
      </Link>)}</div> : null;
    }
  }
}
