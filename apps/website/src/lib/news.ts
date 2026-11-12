import type { PostContentDocument, PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
import { richPlainText } from "@iorder/shared/server/shared/rich-text";

import { getPublishedPostSummaries, getTaxonomy } from "@/lib/backend";

export type NewsTopic = { slug: string; name: string; count: number };

export const newsPostPath = (post: Pick<PublicPostSummary, "slug" | "type">) => post.type === "guide" ? `/ho-tro/huong-dan/${post.slug}` : `/tin-tuc/${post.slug}`;
export const newsTopicPath = (slug: string) => `/tin-tuc/chuyen-muc/${slug}`;

const typeLabels: Record<PublicPostSummary["type"], string> = { announcement: "Thông báo", case_study: "Câu chuyện khách hàng", guide: "Hướng dẫn", news: "Tin tức", promotion: "Khuyến mãi" };
/** Nhãn của bài trên thẻ: chuyên mục đầu tiên; chưa có chuyên mục thì loại bài. */
export const newsLabel = (post: PublicPostSummary) => post.categories[0]?.name ?? typeLabels[post.type];

/**
 * Dữ liệu trang Tin tức: mọi bài trừ hướng dẫn (hướng dẫn có trang riêng), mới nhất trước; các chủ đề là chuyên mục
 * đang có bài, theo thứ tự sắp xếp trong CMS › Chuyên mục & Thẻ.
 */
export async function getNewsIndex(): Promise<{ posts: PublicPostSummary[]; topics: NewsTopic[] }> {
  const [all, taxonomy] = await Promise.all([getPublishedPostSummaries(), getTaxonomy().catch(() => null)]);
  const posts = all.filter((post) => post.type !== "guide");
  const counts = new Map<string, number>();
  for (const post of posts) for (const category of post.categories) counts.set(category.slug, (counts.get(category.slug) ?? 0) + 1);
  const topics = (taxonomy?.categories ?? []).flatMap((category) => counts.has(category.slug) ? [{ slug: category.slug, name: category.name, count: counts.get(category.slug) ?? 0 }] : []);
  return { posts, topics };
}

/** Số trang từ `?trang=`: không hợp lệ hoặc nhỏ hơn 2 coi là trang 1. */
export function parseNewsPage(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

const featuredCount = 5;
const firstPageGrid = 9;
const pageSize = 12;

/**
 * Chia trang. Có khối nổi bật (trang Tin tức): trang 1 = 5 bài nổi bật (1 lớn + 4 nhỏ) + 9 bài lưới, các trang sau 12 bài.
 * Không có (trang chuyên mục): 12 bài mỗi trang.
 */
export function paginateNews(posts: PublicPostSummary[], page: number, withFeatured: boolean) {
  if (!withFeatured) {
    const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
    return { featured: [], grid: posts.slice((page - 1) * pageSize, page * pageSize), totalPages };
  }
  const head = featuredCount + firstPageGrid;
  const totalPages = posts.length <= head ? 1 : 1 + Math.ceil((posts.length - head) / pageSize);
  if (page === 1) return { featured: posts.slice(0, featuredCount), grid: posts.slice(featuredCount, head), totalPages };
  const start = head + (page - 2) * pageSize;
  return { featured: [], grid: posts.slice(start, start + pageSize), totalPages };
}

/** Thời gian đọc ước tính (khoảng 220 từ/phút, tối thiểu 1 phút). */
export function readingMinutes(content: PostContentDocument) {
  const text = content.version === 2 ? richPlainText(content.doc) : content.blocks.map((block) => block.type === "paragraph" ? block.text : [block.heading, ...block.items].join(" ")).join(" ");
  return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));
}

/** Bài liên quan: cùng chuyên mục đầu tiên trước, thiếu thì bù bằng bài mới nhất; không lặp bài đang đọc. */
export function relatedNews(posts: PublicPostSummary[], current: { id: string; categories: { slug: string }[] }, limit = 3) {
  const others = posts.filter((post) => post.id !== current.id);
  const topic = current.categories[0]?.slug;
  const same = topic ? others.filter((post) => post.categories.some((category) => category.slug === topic)) : [];
  return [...same, ...others.filter((post) => !same.includes(post))].slice(0, limit);
}
