import { uncategorizedGuideGroup, type PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
import { suggestSeoDescription } from "@iorder/shared/server/shared/seo";

import { getPublishedPostBySlug, getPublishedPostSummaries, getTaxonomy } from "@/lib/backend";

export type GuideEntry = { href: string; slug: string; title: string; category: string | null; summary: PublicPostSummary };
export type GuideGroup = { key: string; label: string; items: GuideEntry[] };

// Cùng nhãn với cột "Nhóm" trong CMS › Hướng dẫn sử dụng.
const generalGroup = uncategorizedGuideGroup;
export const guideHref = (slug: string) => `/ho-tro/huong-dan/${slug}`;

/**
 * Danh mục bài hướng dẫn cho khung tài liệu (thanh bên trái, trang tổng hợp, bài trước/sau): mỗi chuyên mục một nhóm,
 * bài chưa gắn chuyên mục vào "Hướng dẫn chung" đứng đầu, các nhóm còn lại theo thứ tự sắp xếp của chuyên mục trong
 * CMS › Chuyên mục & Thẻ. Bài có nhiều chuyên mục chỉ nằm ở chuyên mục đầu tiên để thanh danh mục không lặp bài.
 * Thứ tự bài trong nhóm giữ theo CMS.
 */
export async function getGuideIndex(): Promise<{ entries: GuideEntry[]; groups: GuideGroup[] }> {
  const [guides, taxonomy] = await Promise.all([getPublishedPostSummaries("guide"), getTaxonomy().catch(() => ({ categories: [] as { name: string }[] }))]);
  const entries = guides.map((guide): GuideEntry => ({ href: guideHref(guide.slug), slug: guide.slug, title: guide.title, category: guide.categories[0]?.name ?? null, summary: guide }));
  const groups = new Map<string, GuideGroup>();
  for (const entry of entries) {
    const label = entry.category ?? generalGroup;
    const group = groups.get(label) ?? { key: label, label, items: [] };
    group.items.push(entry);
    groups.set(label, group);
  }
  const rank = (label: string) => { if (label === generalGroup) return -1; const index = taxonomy.categories.findIndex((category) => category.name === label); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
  const ordered = [...groups.values()].sort((a, b) => rank(a.label) - rank(b.label));
  // Danh sách phẳng theo đúng thứ tự hiển thị (dùng cho bài trước / bài sau).
  return { entries: ordered.flatMap((group) => group.items), groups: ordered };
}

/** Mô tả ngắn của bài hướng dẫn: tóm tắt; chưa có thì đoạn văn đầu của nội dung (bài nhập từ Word thường để trống tóm tắt). */
export async function guideDescription(guide: PublicPostSummary) {
  if (guide.excerpt) return guide.excerpt;
  return getPublishedPostBySlug(guide.slug).then((post) => post ? suggestSeoDescription(null, post.content) : null).catch(() => null);
}
