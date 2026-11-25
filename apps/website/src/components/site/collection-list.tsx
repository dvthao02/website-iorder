import { AvailabilityBadge } from "./availability-badge";
import Image from "next/image";
import { BookOpen, Check, Inbox } from "lucide-react";
import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
import { SiteLink as Link } from "@/components/site/site-link";

import type { BlockFrame } from "@iorder/shared/server/pages/block-layout";
import type { CollectionListData, CollectionSource } from "@iorder/shared/server/pages/pages.contract";

import { FrameSection, SectionHeading, TextLink } from "@/components/ui";
import { CoverPhoto } from "./cover-photo";
import { DownloadList } from "./download-list";
import { EquipmentExplorer } from "./equipment-explorer";
import { EquipmentImagePlaceholder } from "./equipment-image-placeholder";
import { PostRows, PostSpotlight } from "./post-collection";
import { getEnabledSupportDownloads, getEquipment, getPublishedOfferingSummaries, getPublishedPostSummaries } from "@/lib/backend";
import { getT } from "@/lib/messages";
import { newsLabel } from "@/lib/post-links";
import type { UiMessageKey } from "@iorder/shared/server/translations/ui-messages";

const offeringPath = { software: "/software", solution: "/solutions" } as const;
const emptyKeys: Record<CollectionSource, UiMessageKey> = {
  posts: "empty.posts",
  guides: "empty.guides",
  downloads: "empty.downloads",
  equipment: "empty.equipment",
  software: "empty.software",
  solution: "empty.solution",
};
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const priceFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
// Thẻ ảnh dùng chung với Lưới thẻ: ảnh sát mép trên cùng, phần chữ đệm đều, nhãn dạng chip, dòng cuối thẻ luôn sát đáy.
// Có bóng nhẹ và nổi lên khi rê chuột (.feature-card), cùng kiểu với thẻ ở các khối khác.
const cardClass = "feature-card group flex h-full flex-col overflow-hidden rounded-card border border-line bg-white shadow-card";
const bodyClass = "flex flex-1 flex-col p-5 sm:p-6";
const chipClass = "inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-caption font-semibold text-brand-700";
// Khung ảnh bìa phần mềm / giải pháp / dịch vụ: 16:10, ảnh hiện đủ bằng CoverPhoto fit="contain" (ảnh chụp giao diện, ảnh dọc, sơ đồ ngang dài đều có tỉ lệ khác nhau).
const offeringFrameClass = "relative block aspect-[16/10] w-full overflow-hidden bg-brand-50";
const titleClass = "mb-0 text-h3 font-bold tracking-tight text-ink";
const textClass = "mt-2 mb-0 text-body text-muted";
const metaClass = "mt-auto mb-0 pt-5 text-small text-faint";
const moreClass = "mt-auto mb-0 pt-5 text-small font-semibold text-brand-700 group-hover:underline";

const take = <T,>(items: T[], limit: number | null) => (limit ? items.slice(0, limit) : items);
// Trang tổng hợp của từng nguồn: khối chỉ hiện vài mục (có giới hạn) thì có nút "Xem tất cả" dưới danh sách.
const listingPath: Partial<Record<CollectionSource, string>> = { posts: "/news", guides: "/support/guides", equipment: "/equipment", software: "/software", solution: "/solutions" };

// Khối "Danh sách nội dung": dùng trên trang danh sách (/news, /equipment…) và mọi trang khác.
// Tiêu đề mặc định của site nằm trong @layer base nên class Tailwind trên từng tiêu đề luôn thắng.
// Khi khối không có tiêu đề (thường là ngay dưới phần đầu trang danh sách), thẻ dùng h2.
export async function CollectionList({ data, frame }: { data: CollectionListData; frame: BlockFrame }) {
  const t = await getT();
  const Card = data.title ? "h3" : "h2";
  const dark = frame.tone === "dark";
  const items = await renderItems(data, Card, dark);
  // Khối xem trước (có giới hạn số mục, có trang tổng hợp): "Xem tất cả" nằm dưới danh sách, căn giữa.
  const href = data.limit ? listingPath[data.source] : undefined;
  return <FrameSection frame={frame} label={data.title ?? undefined}>
    {data.title ? <SectionHeading dark={dark} description={data.description} eyebrow={data.eyebrow} title={data.title} /> : null}
    {items ?? <div className="grid justify-items-center gap-3 rounded-card border border-dashed border-line bg-white px-6 py-12 text-center text-body text-muted">
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-control bg-brand-50 text-brand-600"><Inbox size={24} strokeWidth={1.8} /></span>
      {t(emptyKeys[data.source])}
    </div>}
    {items && href ? <div className="mt-8 flex justify-center sm:mt-10"><TextLink className={`button ${dark ? "button--outline-light" : "button--secondary"}`} href={href}>{t("common.viewAll")}</TextLink></div> : null}
  </FrameSection>;
}

// Thẻ bài viết (ảnh, loại bài, tiêu đề, tóm tắt, ngày): danh sách bài viết, trang chuyên mục và trang thẻ.
export async function PostCard({ post, Heading = "h3" }: { post: PublicPostSummary; Heading?: "h2" | "h3" }) {
  const t = await getT();
  const label = newsLabel(post, t);
  const date = post.publishedAt ?? post.createdAt;
  return <Link className={cardClass} href={post.type === "guide" ? `/support/guides/${post.slug}` : `/news/${post.slug}`}>
    {/* Có ảnh: nhãn chuyên mục nằm đè góc ảnh (nhìn thấy ngay chủ đề); chưa có ảnh: nhãn là dòng chữ phía trên tiêu đề. */}
    {post.cover ? <span className="post-media card-media aspect-[16/9]">
      <Image alt={post.cover.altText ?? post.title} height={338} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" src={post.cover.url} width={600} />
      <span className="post-chip">{label}</span>
    </span> : null}
    <div className={bodyClass}>
      {post.cover ? null : <p className="mb-2 text-small font-semibold text-brand-700">{label}</p>}
      <Heading className={`${titleClass} line-clamp-2`}>{post.title}</Heading>
      {post.excerpt ? <p className={`${textClass} line-clamp-2`}>{post.excerpt}</p> : null}
      <p className={`${metaClass} flex items-center justify-between gap-3`}><time dateTime={date.toISOString()}>{dateFormatter.format(date)}</time><span aria-hidden="true" className="font-semibold text-brand-700 group-hover:underline">{t("common.readMore")}</span></p>
    </div>
  </Link>;
}

type EquipmentItem = Awaited<ReturnType<typeof getEquipment>>[number];
// Thẻ thiết bị: dùng ở danh sách thiết bị và phần "Thiết bị khác" của trang chi tiết thiết bị.
export async function EquipmentCard({ item, Heading = "h3" }: { item: EquipmentItem; Heading?: "h2" | "h3" }) {
  const t = await getT();
  return <Link className="equipment-tile group" href={`/equipment/${item.slug}`}>
    <div className="equipment-tile__media">{item.coverUrl ? <Image alt={item.coverAlt ?? item.name} className="equipment-tile__image" height={450} sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" src={item.coverUrl} width={600} /> : <EquipmentImagePlaceholder label={t("common.noImage")} />}</div>
    <div className="equipment-tile__body">
      <p className={`mb-1 ${chipClass}`}>{item.groupName}</p>
      <Heading className="equipment-tile__name mb-0 line-clamp-2">{item.name}</Heading>
      {item.summary ? <p className="equipment-tile__meta m-0 line-clamp-2">{item.summary}</p> : null}
      <div className="mt-auto flex flex-col items-center gap-1 pt-3">
        <p className="equipment-tile__price mb-0">{priceFormatter.format(item.priceVnd)}</p>
        <AvailabilityBadge availability={item.availability} t={t} />
        <span className="equipment-tile__meta">{t("common.warranty", { months: item.warrantyMonths })}</span>
        <span className="text-small font-semibold text-brand-700 group-hover:underline">{t("common.viewDetail")}</span>
      </div>
    </div>
  </Link>;
}

async function renderItems(data: CollectionListData, Card: "h2" | "h3", dark: boolean) {
  const t = await getT();
  switch (data.source) {
    case "posts": {
      // Hướng dẫn có nguồn riêng; "Loại bài" cho một phần trang chỉ hiện ưu đãi, câu chuyện khách hàng… (thiếu hoặc "Tất cả" = mọi loại trừ hướng dẫn).
      const type = data.postType && data.postType !== "all" ? data.postType : null;
      const posts = take((await getPublishedPostSummaries()).filter(post => post.type !== "guide" && (!type || post.type === type)), data.limit);
      if (!posts.length) return null;
      if (data.layout === "featured") return <PostSpotlight Heading={Card} posts={posts} t={t} />;
      if (data.layout === "list") return <PostRows Heading={Card} posts={posts} t={t} />;
      // `data-card-grid="posts"`: móc cho CSS trang chủ (thẻ lẻ cuối ở máy tính bảng xếp ngang, trải hết hai cột).
      return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-card-grid="posts" data-cols={posts.length}>{posts.map(post => <PostCard Heading={Card} key={post.id} post={post} />)}</div>;
    }
    case "guides": {
      const guides = take(await getPublishedPostSummaries("guide"), data.limit);
      // Thẻ gọn dạng hàng (biểu tượng sách, tiêu đề, tóm tắt, ngày), 3 cột trên máy tính: bài hướng dẫn thường không có ảnh bìa.
      return guides.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{guides.map(guide => <Link className="group flex h-full items-start gap-4 rounded-card border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised" href={`/support/guides/${guide.slug}`} key={guide.id}>
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white"><BookOpen size={20} /></span>
        <span className="flex min-w-0 flex-1 flex-col">
          {guide.categories[0] ? <span className={`mb-1.5 ${chipClass}`}>{guide.categories[0].name}</span> : null}
          <Card className="mb-0 text-lead leading-snug font-bold tracking-tight text-ink group-hover:text-brand-700">{guide.title}</Card>
          {guide.excerpt ? <span className="mt-1 line-clamp-2 text-small text-muted">{guide.excerpt}</span> : null}
          <span className="mt-2 text-caption text-faint">{t("common.updatedOn", { date: dateFormatter.format(guide.publishedAt ?? guide.createdAt) })}</span>
        </span>
      </Link>)}</div> : null;
    }
    case "downloads": {
      const downloads = take(await getEnabledSupportDownloads(), data.limit);
      // Danh sách gọn mỗi tệp một dòng; tự gom nhóm khi "Thông tin phụ" (ví dụ "Máy in hóa đơn") lặp lại.
      return downloads.length ? <DownloadList Heading={Card} items={downloads} t={t} /> : null;
    }
    case "equipment": {
      const equipment = take(await getEquipment(true), data.limit);
      // Ảnh thiết bị cùng khung 4:3 nền nhạt sát mép thẻ, ảnh nằm gọn bên trong (ảnh nền trong suốt vẫn đều nhau); 4 cột trên màn rộng.
      // Lưới chọn thiết bị: bấm thẻ mở chi tiết ngay dưới hàng. Hiện tất cả (trang Thiết bị) thì chia theo nhóm.
      const grouped = !data.limit && new Set(equipment.map(item => item.groupName)).size > 1;
      return equipment.length ? <EquipmentExplorer dark={dark} grouped={grouped} Heading={Card} items={equipment.map(item => ({ id: item.id, slug: item.slug, name: item.name, modelCode: item.modelCode ?? null, priceVnd: item.priceVnd, availability: item.availability, warrantyMonths: item.warrantyMonths, summary: item.summary ?? null, groupName: item.groupName, coverUrl: item.coverUrl, coverAlt: item.coverAlt ?? null, specificationGroups: item.specificationGroups }))} /> : null;
    }
    case "software":
    case "solution": {
      // Dữ liệu từ Backend cũ hoặc cache trước khi có chuyên mục/số liệu thì thiếu hai trường này: coi như trống, không làm sập trang.
      const offerings = take(await getPublishedOfferingSummaries(data.source), data.limit);
      // Nhãn "Nổi bật" chỉ có nghĩa khi có mục không nổi bật đứng cạnh.
      const markFeatured = offerings.some(offering => !offering.isFeatured);
      // Hai mục thì hai cột rộng vừa phải (không để trống một ô của lưới ba cột).
      return offerings.length ? <div className={`grid gap-5 sm:grid-cols-2 ${offerings.length === 2 ? "lg:mx-auto lg:max-w-5xl" : "lg:grid-cols-3"}`}>{offerings.map(offering => <Link className={cardClass} href={`${offeringPath[data.source as keyof typeof offeringPath]}/${offering.slug}`} key={offering.id}>
        {offering.cover ? <span className={offeringFrameClass}><CoverPhoto alt={t("offering.coverSolution", { name: offering.title })} className="transition duration-500 group-hover:scale-[1.02]" fit="contain" photos={[{ url: offering.cover.url, altText: offering.cover.altText ?? null }]} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" /></span> : null}
        <div className={bodyClass}>
          {offering.category || (markFeatured && offering.isFeatured) ? <p className="mb-3 flex flex-wrap gap-2">
            {markFeatured && offering.isFeatured ? <span className="inline-flex w-fit items-center rounded-full bg-brand-600 px-2.5 py-0.5 text-caption font-semibold text-white">{t("common.featured")}</span> : null}
            {offering.category ? <span className={chipClass}>{offering.category}</span> : null}
          </p> : null}
          <Card className={`${titleClass} line-clamp-2`}>{offering.title}</Card>
          {offering.summary ? <p className={`${textClass} line-clamp-3`}>{offering.summary}</p> : null}
          {/* Số liệu nổi bật (CMS › Sản phẩm › Số liệu): bằng chứng ngắn ngay trên thẻ, tối đa hai dòng. */}
          {offering.metrics?.length ? <ul className="m-0 mt-4 grid list-none gap-1.5 p-0">{offering.metrics.slice(0, 2).map(metric => <li className="flex items-start gap-2 text-small font-semibold text-ink" key={metric}>
            <Check aria-hidden="true" className="mt-0.5 shrink-0 text-accent-green" size={16} strokeWidth={2.6} />{metric}
          </li>)}</ul> : null}
          <p className={moreClass}>{t("common.viewDetail")}</p>
        </div>
      </Link>)}</div> : null;
    }
  }
}
