import type { PublicPostSummary } from "@iorder/core/server/posts/posts.contract";
import { suggestSeoDescription } from "@iorder/core/server/shared/seo";

import { getPublishedPostBySlug, getPublishedPostSummaries } from "@/lib/backend";

export type GuideEntry = { href: string; slug: string; title: string; category: string | null; summary: PublicPostSummary };
export type GuideGroup = { key: string; label: string; items: GuideEntry[] };

const generalGroup = "Hướng dẫn chung";
export const guideHref = (slug: string) => `/ho-tro/huong-dan/${slug}`;

/**
 * Danh mục bài hướng dẫn cho khung tài liệu (thanh bên trái, trang tổng hợp, bài trước/sau): mỗi chuyên mục một nhóm,
 * bài chưa gắn chuyên mục vào "Hướng dẫn chung" đứng đầu. Bài có nhiều chuyên mục chỉ nằm ở chuyên mục đầu tiên
 * để thanh danh mục không lặp bài. Thứ tự bài giữ theo CMS.
 */
export async function getGuideIndex(): Promise<{ entries: GuideEntry[]; groups: GuideGroup[] }> {
  const guides = await getPublishedPostSummaries("guide");
  const entries = guides.map((guide): GuideEntry => ({ href: guideHref(guide.slug), slug: guide.slug, title: guide.title, category: guide.categories[0]?.name ?? null, summary: guide }));
  const groups = new Map<string, GuideGroup>();
  for (const entry of entries) {
    const label = entry.category ?? generalGroup;
    const group = groups.get(label) ?? { key: label, label, items: [] };
    group.items.push(entry);
    groups.set(label, group);
  }
  const ordered = [...groups.values()].sort((a, b) => Number(b.label === generalGroup) - Number(a.label === generalGroup));
  // Danh sách phẳng theo đúng thứ tự hiển thị (dùng cho bài trước / bài sau).
  return { entries: ordered.flatMap((group) => group.items), groups: ordered };
}

/** Mô tả ngắn của bài hướng dẫn: tóm tắt; chưa có thì đoạn văn đầu của nội dung (bài nhập từ Word thường để trống tóm tắt). */
export async function guideDescription(guide: PublicPostSummary) {
  if (guide.excerpt) return guide.excerpt;
  return getPublishedPostBySlug(guide.slug).then((post) => post ? suggestSeoDescription(null, post.content) : null).catch(() => null);
}
