import Image from "next/image";
import { ArrowRight } from "lucide-react";
import React from "react";

import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
// Đường dẫn tương đối (không dùng @/) để thành phần này chạy được trong test đơn vị.
import { newsLabel, newsPostPath } from "../../lib/post-links";
import { createTranslate, type Translate } from "../../lib/translate";
import { SiteLink as Link } from "./site-link";

// Hai bố cục danh sách bài viết cho khối "Danh sách nội dung" (trang chủ, landing page…): mỗi bài là một thẻ trắng có viền và bóng nhẹ
// (như PostCard) nên đọc rõ trên cả nền sáng, nhạt lẫn tối. Heading: cấp tiêu đề của từng bài (h2 khi khối không có tiêu đề, h3 khi có).

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const dateOf = (post: PublicPostSummary) => post.publishedAt ?? post.createdAt;

function PostDate({ post }: { post: PublicPostSummary }) {
  return <time dateTime={dateOf(post).toISOString()}>{dateFormatter.format(dateOf(post))}</time>;
}

type Heading = "h2" | "h3";

/** Một bài nổi bật (ảnh lớn, nhãn chủ đề, tiêu đề, tóm tắt, "Đọc tiếp") bên trái; các bài kế tiếp thành danh sách gọn bên phải. Trên điện thoại xếp dọc. */
export function PostSpotlight({ posts, Heading = "h3", t = createTranslate() }: { posts: PublicPostSummary[]; Heading?: Heading; t?: Translate }) {
  const [lead, ...rest] = posts;
  if (!lead) return null;
  return <div className="post-spotlight">
    <Link className="post-spotlight__lead group" href={newsPostPath(lead)}>
      <span className="post-media post-spotlight__media">
        {lead.cover ? <Image alt={lead.cover.altText ?? lead.title} height={563} sizes="(min-width: 1024px) 58vw, 100vw" src={lead.cover.url} width={1000} /> : null}
        <span className="post-chip">{newsLabel(lead, t)}</span>
      </span>
      <span className="post-spotlight__body">
        <span className="post-meta"><PostDate post={lead} /></span>
        <Heading className="post-spotlight__title">{lead.title}</Heading>
        {lead.excerpt ? <span className="post-spotlight__excerpt">{lead.excerpt}</span> : null}
        <span className="post-more">{t("common.readMoreShort")}<ArrowRight aria-hidden="true" size={16} /></span>
      </span>
    </Link>
    {rest.length ? <ul className="post-spotlight__side">{rest.map((post) => <li key={post.id}>
      <Link className="post-side group" href={newsPostPath(post)}>
        <span className="post-media post-side__media">{post.cover ? <Image alt="" height={120} sizes="(min-width: 640px) 160px, 112px" src={post.cover.url} width={160} /> : null}</span>
        <span className="min-w-0">
          <span className="post-meta"><span className="post-meta__topic">{newsLabel(post, t)}</span><PostDate post={post} /></span>
          <Heading className="post-side__title">{post.title}</Heading>
          {post.excerpt ? <span className="post-side__excerpt">{post.excerpt}</span> : null}
        </span>
      </Link>
    </li>)}</ul> : null}
  </div>;
}

/** Từng hàng: ảnh bên trái, nhãn + tiêu đề + tóm tắt bên phải; hai cột trên máy tính. Hợp khi bài có tóm tắt dài hoặc cần đọc nhanh nhiều bài. */
export function PostRows({ posts, Heading = "h3", t = createTranslate() }: { posts: PublicPostSummary[]; Heading?: Heading; t?: Translate }) {
  return <ul className="post-rows">{posts.map((post) => <li key={post.id}>
    <Link className="post-row group" href={newsPostPath(post)}>
      <span className="post-media post-row__media">{post.cover ? <Image alt="" height={180} sizes="(min-width: 640px) 220px, 120px" src={post.cover.url} width={240} /> : null}</span>
      <span className="post-row__body">
        <span className="post-meta"><span className="post-meta__topic">{newsLabel(post, t)}</span><PostDate post={post} /></span>
        <Heading className="post-row__title">{post.title}</Heading>
        {post.excerpt ? <span className="post-row__excerpt">{post.excerpt}</span> : null}
        <span className="post-more post-row__more">{t("common.readMoreShort")}<ArrowRight aria-hidden="true" size={16} /></span>
      </span>
    </Link>
  </li>)}</ul>;
}
