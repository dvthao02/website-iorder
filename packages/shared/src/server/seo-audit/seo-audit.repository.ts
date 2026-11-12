import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@iorder/shared/db/client";
import { equipmentGroups, offerings, pageBlocks, pages, posts, salesEquipment } from "@iorder/shared/db/schema";
import { postContentDocumentSchema } from "../posts/posts.contract";
import { getFixedWebsitePage } from "../pages/pages.contract";
import { equipmentPublicPath, offeringPublicPath, pagePublicPath, postPublicPath } from "../shared/content-paths";
import { suggestSeoDescription } from "../shared/seo";
import { liveContentCondition } from "../shared/live-content";
import type { SeoAuditEntry } from "./seo-audit";

// publish-web gắn hậu tố này vào tiêu đề trang chi tiết (bài viết, sản phẩm, thiết bị); trang thì không.
const detailTitleSuffix = " | iOrder";

const heroDataSchema = z.object({ title: z.string().nullish(), description: z.string().nullish() });

function liveCondition(table: typeof pages | typeof posts | typeof offerings | typeof salesEquipment, now: Date) {
  return and(isNull(table.deletedAt), liveContentCondition(table, now));
}

async function pageEntries(now: Date): Promise<SeoAuditEntry[]> {
  const rows = await getDb().select({ id: pages.id, title: pages.title, slug: pages.slug, seoTitle: pages.seoTitle, seoDescription: pages.seoDescription })
    .from(pages).where(liveCondition(pages, now));
  if (!rows.length) return [];
  // Trang danh sách lấy tiêu đề/mô tả dự phòng từ khối "Phần đầu trang" đầu tiên đang bật (listing-page.ts).
  const heroes = await getDb().select({ pageId: pageBlocks.pageId, data: pageBlocks.data }).from(pageBlocks)
    .where(and(inArray(pageBlocks.pageId, rows.map((row) => row.id)), eq(pageBlocks.type, "hero"), eq(pageBlocks.isEnabled, true)))
    .orderBy(asc(pageBlocks.sortOrder));
  const firstHero = new Map<string, z.infer<typeof heroDataSchema>>();
  for (const hero of heroes) {
    const parsed = heroDataSchema.safeParse(hero.data);
    if (parsed.success && !firstHero.has(hero.pageId)) firstHero.set(hero.pageId, parsed.data);
  }
  return rows.map((row) => {
    const listing = getFixedWebsitePage(row.slug)?.kind === "listing";
    const hero = listing ? firstHero.get(row.id) : undefined;
    return {
      kind: "page", id: row.id, type: null, label: row.title, path: pagePublicPath(row.slug),
      title: row.seoTitle || hero?.title || row.title,
      description: row.seoDescription || hero?.description || null,
      hasImage: null,
    };
  });
}

async function postEntries(now: Date): Promise<SeoAuditEntry[]> {
  const rows = await getDb().select({ id: posts.id, title: posts.title, slug: posts.slug, type: posts.type, excerpt: posts.excerpt, content: posts.content, seoTitle: posts.seoTitle, seoDescription: posts.seoDescription, coverMediaId: posts.coverMediaId })
    .from(posts).where(liveCondition(posts, now));
  return rows.map((row) => {
    const content = postContentDocumentSchema.safeParse(row.content);
    return {
      kind: "post", id: row.id, type: row.type, label: row.title, path: postPublicPath(row.slug, row.type),
      title: `${row.seoTitle ?? row.title}${detailTitleSuffix}`,
      description: row.seoDescription ?? suggestSeoDescription(row.excerpt, content.success ? content.data : null),
      hasImage: Boolean(row.coverMediaId),
    };
  });
}

async function offeringEntries(now: Date): Promise<SeoAuditEntry[]> {
  const rows = await getDb().select({ id: offerings.id, title: offerings.title, slug: offerings.slug, type: offerings.type, summary: offerings.summary, seoTitle: offerings.seoTitle, seoDescription: offerings.seoDescription, coverMediaId: offerings.coverMediaId })
    .from(offerings).where(liveCondition(offerings, now));
  return rows.flatMap((row) => {
    const path = offeringPublicPath(row.slug, row.type);
    return path ? [{
      kind: "offering" as const, id: row.id, type: row.type, label: row.title, path,
      title: `${row.seoTitle ?? row.title}${detailTitleSuffix}`,
      description: row.seoDescription ?? row.summary ?? null,
      hasImage: Boolean(row.coverMediaId),
    }] : [];
  });
}

async function equipmentEntries(now: Date): Promise<SeoAuditEntry[]> {
  const rows = await getDb().select({ id: salesEquipment.id, name: salesEquipment.name, slug: salesEquipment.slug, summary: salesEquipment.summary, seoTitle: salesEquipment.seoTitle, seoDescription: salesEquipment.seoDescription, coverMediaId: salesEquipment.coverMediaId })
    .from(salesEquipment).innerJoin(equipmentGroups, eq(salesEquipment.groupId, equipmentGroups.id))
    .where(and(liveCondition(salesEquipment, now), eq(equipmentGroups.isEnabled, true), isNull(equipmentGroups.deletedAt)));
  return rows.map((row) => ({
    kind: "equipment", id: row.id, type: null, label: row.name, path: equipmentPublicPath(row.slug),
    title: `${row.seoTitle || row.name}${detailTitleSuffix}`,
    description: row.seoDescription || row.summary || null,
    hasImage: Boolean(row.coverMediaId),
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
