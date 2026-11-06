import Image from "next/image";
import Link from "next/link";

import type { BlockFrame } from "@iorder/core/server/pages/block-layout";
import type { CollectionListData, CollectionSource } from "@iorder/core/server/pages/pages.contract";

import { FrameSection, SectionHeading, TextLink } from "@/components/ui";
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
// Thẻ ảnh dùng chung với Lưới thẻ: ảnh sát mép trên cùng, phần chữ đệm đều, nhãn dạng chip, dòng cuối thẻ luôn sát đáy.
const cardClass = "group flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised";
const bodyClass = "flex flex-1 flex-col p-5 sm:p-6";
const chipClass = "inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-caption font-semibold text-brand-700";
const titleClass = "mb-0 text-h3 font-bold tracking-tight text-ink";
const textClass = "mt-2 mb-0 text-body text-muted";
const metaClass = "mt-auto mb-0 pt-5 text-small text-faint";
const moreClass = "mt-auto mb-0 pt-5 text-small font-semibold text-brand-700 group-hover:underline";

const take = <T,>(items: T[], limit: number | null) => (limit ? items.slice(0, limit) : items);
// Trang tổng hợp của từng nguồn: khối chỉ hiện vài mục (có giới hạn) thì có liên kết "Xem tất cả" cạnh tiêu đề.
const listingPath: Partial<Record<CollectionSource, string>> = { posts: "/tin-tuc", guides: "/ho-tro/huong-dan", equipment: "/thiet-bi", software: "/phan-mem", solution: "/giai-phap", service: "/dich-vu" };

// Khối "Danh sách nội dung": dùng trên trang danh sách (/tin-tuc, /thiet-bi…) và mọi trang khác.
// Tiêu đề mặc định của site nằm trong @layer base nên class Tailwind trên từng tiêu đề luôn thắng.
// Khi khối không có tiêu đề (thường là ngay dưới phần đầu trang danh sách), thẻ dùng h2.
export async function CollectionList({ data, frame }: { data: CollectionListData; frame: BlockFrame }) {
  const Card = data.title ? "h3" : "h2";
  const items = await renderItems(data, Card);
  return <FrameSection frame={frame} label={data.title ?? undefined}>
    {data.title ? <ListHeading data={data} dark={frame.tone === "dark"} /> : null}
    {items ?? <div className="rounded-card border border-dashed border-line bg-white p-8 text-body text-muted">{emptyMessages[data.source]}</div>}
  </FrameSection>;
}

// Khối xem trước (có giới hạn số mục, có trang tổng hợp): tiêu đề căn trái, "Xem tất cả" bên phải, khác nhịp với các khối
// giới thiệu căn giữa. Trang danh sách đầy đủ (không giới hạn) giữ tiêu đề căn giữa.
function ListHeading({ data, dark }: { data: CollectionListData; dark: boolean }) {
  const href = data.limit ? listingPath[data.source] : undefined;
  if (!href) return <SectionHeading dark={dark} description={data.description} eyebrow={data.eyebrow} title={data.title} />;
  return <div className="section-heading mb-10 flex flex-col gap-5 sm:mb-12 md:flex-row md:items-end md:justify-between">
    <SectionHeading align="left" className="" dark={dark} description={data.description} eyebrow={data.eyebrow} title={data.title} />
    <TextLink className={`button shrink-0 self-start md:self-auto ${dark ? "button--outline-light" : "button--secondary"}`} href={href}>Xem tất cả →</TextLink>
  </div>;
}

type EquipmentItem = Awaited<ReturnType<typeof getEquipment>>[number];
// Thẻ thiết bị: dùng ở danh sách thiết bị và phần "Thiết bị khác" của trang chi tiết thiết bị.
export function EquipmentCard({ item, Heading = "h3" }: { item: EquipmentItem; Heading?: "h2" | "h3" }) {
  return <Link className={cardClass} href={`/thiet-bi/${item.slug}`}>
    {item.coverUrl ? <Image alt={item.coverAlt ?? item.name} className="aspect-[4/3] w-full border-b border-line bg-subtle object-contain p-5 transition duration-500 group-hover:scale-[1.02]" height={450} sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" src={item.coverUrl} width={600} /> : null}
    <div className={bodyClass}>
      <p className={`mb-3 ${chipClass}`}>{item.groupName}</p>
      <Heading className={`${titleClass} line-clamp-2`}>{item.name}</Heading>
      {item.summary ? <p className={`${textClass} line-clamp-2`}>{item.summary}</p> : null}
      <div className="mt-auto flex flex-col gap-1 pt-5">
        <p className="mb-0 text-h3 font-bold text-brand-700">{priceFormatter.format(item.priceVnd)}</p>
        <span className="text-small font-semibold text-brand-700 group-hover:underline">Xem chi tiết →</span>
      </div>
    </div>
  </Link>;
}

async function renderItems(data: CollectionListData, Card: "h2" | "h3") {
  switch (data.source) {
    case "posts": {
      const posts = take((await getPublishedPostSummaries()).filter(post => post.type !== "guide"), data.limit);
      return posts.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.map(post => <Link className={cardClass} href={`/tin-tuc/${post.slug}`} key={post.id}>
        {post.cover ? <Image alt={post.cover.altText ?? post.title} className="card-media aspect-[16/9] w-full bg-subtle object-cover transition duration-500 group-hover:scale-[1.02]" height={338} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" src={post.cover.url} width={600} /> : null}
        <div className={bodyClass}>
          <p className={`mb-3 ${chipClass}`}>{postTypeLabel[post.type]}</p>
          <Card className={`${titleClass} line-clamp-2`}>{post.title}</Card>
          {post.excerpt ? <p className={`${textClass} line-clamp-2`}>{post.excerpt}</p> : null}
          <p className={metaClass}>{dateFormatter.format(post.publishedAt ?? post.createdAt)}</p>
        </div>
      </Link>)}</div> : null;
    }
    case "guides": {
      const guides = take(await getPublishedPostSummaries("guide"), data.limit);
      return guides.length ? <div className="grid gap-5 sm:grid-cols-2">{guides.map(guide => <Link className={cardClass} href={`/ho-tro/huong-dan/${guide.slug}`} key={guide.id}>
        <div className={bodyClass}>
          <p className={`mb-3 ${chipClass}`}>{guide.categories[0]?.name ?? "Hướng dẫn iOrder"}</p>
          <Card className={titleClass}>{guide.title}</Card>
          {guide.excerpt ? <p className={textClass}>{guide.excerpt}</p> : null}
          <p className={metaClass}>{dateFormatter.format(guide.publishedAt ?? guide.createdAt)}</p>
        </div>
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
      // Ảnh thiết bị cùng khung 4:3 nền nhạt sát mép thẻ, ảnh nằm gọn bên trong (ảnh nền trong suốt vẫn đều nhau); 4 cột trên màn rộng.
      return equipment.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{equipment.map(item => <EquipmentCard Heading={Card} item={item} key={item.id} />)}</div> : null;
    }
    case "software":
    case "solution":
    case "service": {
      const offerings = take(await getPublishedOfferingSummaries(data.source), data.limit);
      // Nhãn "Nổi bật" chỉ có nghĩa khi có mục không nổi bật đứng cạnh.
      const markFeatured = offerings.some(offering => !offering.isFeatured);
      return offerings.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{offerings.map(offering => <Link className={cardClass} href={`${offeringPath[data.source as keyof typeof offeringPath]}/${offering.slug}`} key={offering.id}>
        {offering.cover ? <Image alt={offering.cover.altText ?? `Ảnh minh họa ${offering.title}`} className="aspect-[16/10] w-full bg-brand-50 object-cover transition duration-500 group-hover:scale-[1.02]" height={offering.cover.height ?? 630} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" src={offering.cover.url} width={offering.cover.width ?? 1200} /> : null}
        <div className={bodyClass}>
          {markFeatured && offering.isFeatured ? <p className={`mb-3 ${chipClass}`}>Nổi bật</p> : null}
          <Card className={`${titleClass} line-clamp-2`}>{offering.title}</Card>
          {offering.summary ? <p className={`${textClass} line-clamp-3`}>{offering.summary}</p> : null}
          <p className={moreClass}>Xem chi tiết →</p>
        </div>
      </Link>)}</div> : null;
    }
  }
}
