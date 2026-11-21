import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@iorder/shared/db/client";
import { equipmentGroups, mediaAssets, offerings, pageBlocks, pages, posts, salesEquipment } from "@iorder/shared/db/schema";
import { postContentDocumentSchema } from "../posts/posts.contract";
import { getFixedWebsitePage } from "../pages/pages.contract";
import { equipmentPublicPath, offeringPublicPath, pagePublicPath, postPublicPath } from "../shared/content-paths";
import { contentSeoAuditSchema } from "../shared/content-seo";
import { suggestPageSeoDescription, suggestSeoDescription, type DescribableBlock } from "../shared/seo";
import { liveContentCondition } from "../shared/live-content";
import type { SeoAuditEntry } from "./seo-audit";

// publish-web gắn hậu tố này vào tiêu đề trang chi tiết (bài viết, sản phẩm, thiết bị); trang thì không.
const detailTitleSuffix = " | iOrder";

// Cờ noindex và từ khóa chính đọc từ JSONB seo; dữ liệu hỏng thì coi như không đặt (website cũng làm vậy).
function seoSignals(seo: unknown) { const parsed = contentSeoAuditSchema.safeParse(seo); return { noindex: parsed.success && parsed.data.index === false, focusKeyword: (parsed.success && parsed.data.focusKeyword) || null }; }
// Ảnh bìa: null khi không có ảnh; false khi có ảnh nhưng chưa có mô tả thay thế.
function imageAlt(coverMediaId: string | null, altText: string | null) { return coverMediaId ? Boolean(altText?.trim()) : null; }

const heroDataSchema = z.object({ title: z.string().nullish(), description: z.string().nullish() });

function liveCondition(table: typeof pages | typeof posts | typeof offerings | typeof salesEquipment, now: Date) {
  return and(isNull(table.deletedAt), liveContentCondition(table, now));
}

async function pageEntries(now: Date): Promise<SeoAuditEntry[]> {
  const rows = await getDb().select({ id: pages.id, title: pages.title, slug: pages.slug, seoTitle: pages.seoTitle, seoDescription: pages.seoDescription, canonicalUrl: pages.canonicalUrl, seo: pages.seo })
    .from(pages).where(liveCondition(pages, now));
  if (!rows.length) return [];
  // Trang danh sách lấy tiêu đề/mô tả dự phòng từ khối "Phần đầu trang" đầu tiên đang bật (listing-page.ts); mọi Trang tự lấy
  // mô tả từ các khối chữ khi để trống (suggestPageSeoDescription, cùng quy tắc với website).
  const blockRows = await getDb().select({ pageId: pageBlocks.pageId, type: pageBlocks.type, data: pageBlocks.data }).from(pageBlocks)
    .where(and(inArray(pageBlocks.pageId, rows.map((row) => row.id)), inArray(pageBlocks.type, ["hero", "media_text", "rich_text", "partners", "lead_form"]), eq(pageBlocks.isEnabled, true)))
    .orderBy(asc(pageBlocks.sortOrder));
  const firstHero = new Map<string, z.infer<typeof heroDataSchema>>();
  const textBlocks = new Map<string, DescribableBlock[]>();
  for (const block of blockRows) {
    textBlocks.set(block.pageId, [...(textBlocks.get(block.pageId) ?? []), { type: block.type, isEnabled: true, data: block.data }]);
    const parsed = block.type === "hero" ? heroDataSchema.safeParse(block.data) : null;
    if (parsed?.success && !firstHero.has(block.pageId)) firstHero.set(block.pageId, parsed.data);
  }
  return rows.map((row) => {
    const listing = getFixedWebsitePage(row.slug)?.kind === "listing";
    const hero = listing ? firstHero.get(row.id) : undefined;
    return {
      kind: "page", id: row.id, type: null, label: row.title, path: pagePublicPath(row.slug),
      title: row.seoTitle || hero?.title || row.title,
      description: row.seoDescription || hero?.description || suggestPageSeoDescription(textBlocks.get(row.id)),
      hasImage: null, imageHasAlt: null, ...seoSignals(row.seo), canonicalUrl: row.canonicalUrl,
    };
  });
}

async function postEntries(now: Date): Promise<SeoAuditEntry[]> {
  const rows = await getDb().select({ id: posts.id, title: posts.title, slug: posts.slug, type: posts.type, excerpt: posts.excerpt, content: posts.content, seoTitle: posts.seoTitle, seoDescription: posts.seoDescription, coverMediaId: posts.coverMediaId, canonicalUrl: posts.canonicalUrl, seo: posts.seo, coverAlt: mediaAssets.altText })
    .from(posts).leftJoin(mediaAssets, eq(posts.coverMediaId, mediaAssets.id)).where(liveCondition(posts, now));
  return rows.map((row) => {
    const content = postContentDocumentSchema.safeParse(row.content);
    return {
      kind: "post", id: row.id, type: row.type, label: row.title, path: postPublicPath(row.slug, row.type),
      title: `${row.seoTitle ?? row.title}${detailTitleSuffix}`,
      description: row.seoDescription ?? suggestSeoDescription(row.excerpt, content.success ? content.data : null),
      hasImage: Boolean(row.coverMediaId), imageHasAlt: imageAlt(row.coverMediaId, row.coverAlt), ...seoSignals(row.seo), canonicalUrl: row.canonicalUrl,
      body: { content: content.success ? content.data : null },
    };
  });
}

async function offeringEntries(now: Date): Promise<SeoAuditEntry[]> {
  const rows = await getDb().select({ id: offerings.id, title: offerings.title, slug: offerings.slug, type: offerings.type, summary: offerings.summary, seoTitle: offerings.seoTitle, seoDescription: offerings.seoDescription, coverMediaId: offerings.coverMediaId, canonicalUrl: offerings.canonicalUrl, seo: offerings.seo, coverAlt: mediaAssets.altText })
    .from(offerings).leftJoin(mediaAssets, eq(offerings.coverMediaId, mediaAssets.id)).where(liveCondition(offerings, now));
  return rows.flatMap((row) => {
    const path = offeringPublicPath(row.slug, row.type);
    return path ? [{
      kind: "offering" as const, id: row.id, type: row.type, label: row.title, path,
      title: `${row.seoTitle ?? row.title}${detailTitleSuffix}`,
      description: row.seoDescription ?? row.summary ?? null,
      hasImage: Boolean(row.coverMediaId), imageHasAlt: imageAlt(row.coverMediaId, row.coverAlt), ...seoSignals(row.seo), canonicalUrl: row.canonicalUrl,
    }] : [];
  });
}

async function equipmentEntries(now: Date): Promise<SeoAuditEntry[]> {
  const rows = await getDb().select({ id: salesEquipment.id, name: salesEquipment.name, slug: salesEquipment.slug, summary: salesEquipment.summary, seoTitle: salesEquipment.seoTitle, seoDescription: salesEquipment.seoDescription, coverMediaId: salesEquipment.coverMediaId, canonicalUrl: salesEquipment.canonicalUrl, seo: salesEquipment.seo, coverAlt: mediaAssets.altText })
    .from(salesEquipment).innerJoin(equipmentGroups, eq(salesEquipment.groupId, equipmentGroups.id)).leftJoin(mediaAssets, eq(salesEquipment.coverMediaId, mediaAssets.id))
    .where(and(liveCondition(salesEquipment, now), eq(equipmentGroups.isEnabled, true), isNull(equipmentGroups.deletedAt)));
  return rows.map((row) => ({
    kind: "equipment", id: row.id, type: null, label: row.name, path: equipmentPublicPath(row.slug),
    title: `${row.seoTitle || row.name}${detailTitleSuffix}`,
    description: row.seoDescription || row.summary || null,
    hasImage: Boolean(row.coverMediaId), imageHasAlt: imageAlt(row.coverMediaId, row.coverAlt), ...seoSignals(row.seo), canonicalUrl: row.canonicalUrl,
  }));
}

export async function listSeoAuditEntries(include: { pages: boolean; posts: boolean; offerings: boolean; equipment: boolean }, now = new Date()) {
  const groups = await Promise.all([
    include.pages ? pageEntries(now) : [],
    include.posts ? postEntries(now) : [],
    include.offerings ? offeringEntries(now) : [],
    include.equipment ? equipmentEntries(now) : [],
  ]);
  return groups.flat();
}
