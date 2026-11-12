import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
import { newsLabel, newsPostPath, newsTopicPath, type NewsTopic } from "@/lib/news";
import { PostCard } from "./collection-list";
import { SiteLink as Link } from "./site-link";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const postDate = (post: PublicPostSummary) => dateFormatter.format(post.publishedAt ?? post.createdAt);

/**
 * Thanh chủ đề dưới phần đầu trang Tin tức / chuyên mục: chữ thường, mục đang xem gạch chân xanh (cùng kiểu menu đầu trang),
 * trượt ngang trên điện thoại. "Tất cả" về /tin-tuc.
 */
export function NewsTopics({ topics, active }: { topics: NewsTopic[]; active: string | null }) {
  if (!topics.length) return null;
  return <nav aria-label="Chủ đề tin tức" className="news-topics">
    <ul className="site-container news-topics__list">
      <li><Link aria-current={active === null ? "page" : undefined} href="/tin-tuc">Tất cả</Link></li>
      {topics.map((topic) => <li key={topic.slug}><Link aria-current={active === topic.slug ? "page" : undefined} href={newsTopicPath(topic.slug)}>{topic.name}<span className="news-topics__count">{topic.count}</span></Link></li>)}
    </ul>
  </nav>;
}

/**
 * Khối nổi bật (trang Tin tức, trang 1): bài mới nhất lớn bên trái (ảnh, chủ đề, ngày, tiêu đề, tóm tắt),
 * các bài kế tiếp thành danh sách gọn bên phải (ảnh nhỏ, chủ đề, tiêu đề, ngày) ngăn bằng đường kẻ.
 */
export function NewsFeatured({ posts }: { posts: PublicPostSummary[] }) {
  const [lead, ...rest] = posts;
  if (!lead) return null;
  return <section aria-label="Bài nổi bật" className="news-featured site-container">
    <Link className="news-lead group" href={newsPostPath(lead)}>
      {lead.cover ? <Image alt={lead.cover.altText ?? lead.title} className="news-lead__image" height={450} priority sizes="(min-width: 1024px) 58vw, 100vw" src={lead.cover.url} width={800} /> : null}
      <p className="news-meta"><span className="news-meta__topic">{newsLabel(lead)}</span><span>{postDate(lead)}</span></p>
      <h2 className="news-lead__title">{lead.title}</h2>
      {lead.excerpt ? <p className="news-lead__excerpt">{lead.excerpt}</p> : null}
    </Link>
    {rest.length ? <ul className="news-side">{rest.map((post) => <li key={post.id}>
      <Link className="news-side__item group" href={newsPostPath(post)}>
        {post.cover ? <Image alt="" className="news-side__image" height={90} sizes="140px" src={post.cover.url} width={140} /> : <span aria-hidden="true" className="news-side__image" />}
        <span className="min-w-0">
          <span className="news-meta"><span className="news-meta__topic">{newsLabel(post)}</span><span>{postDate(post)}</span></span>
          <span className="news-side__title">{post.title}</span>
        </span>
      </Link>
    </li>)}</ul> : null}
  </section>;
}

export function NewsGrid({ posts }: { posts: PublicPostSummary[] }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.map((post) => <PostCard Heading="h3" key={post.id} post={post} />)}</div>;
}

/** Phân trang `?trang=n` (trang 1 không có tham số để mỗi nội dung một URL). */
export function NewsPagination({ page, totalPages, basePath }: { page: number; totalPages: number; basePath: string }) {
  if (totalPages <= 1) return null;
  const href = (target: number) => target <= 1 ? basePath : `${basePath}?trang=${target}`;
  return <nav aria-label="Phân trang" className="news-pagination">
    {page > 1 ? <Link aria-label="Trang trước" href={href(page - 1)} rel="prev"><ChevronLeft aria-hidden="true" size={18} /></Link> : <span aria-hidden="true" className="news-pagination__disabled"><ChevronLeft size={18} /></span>}
    {Array.from({ length: totalPages }, (_, index) => index + 1).map((target) => <Link aria-current={target === page ? "page" : undefined} href={href(target)} key={target}>{target}</Link>)}
    {page < totalPages ? <Link aria-label="Trang sau" href={href(page + 1)} rel="next"><ChevronRight aria-hidden="true" size={18} /></Link> : <span aria-hidden="true" className="news-pagination__disabled"><ChevronRight size={18} /></span>}
  </nav>;
}
