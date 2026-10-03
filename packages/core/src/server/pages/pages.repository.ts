import { and, asc, desc, eq, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, pageBlocks, pageRevisions, pages } from "@iorder/core/db/schema";
import type { PageInput } from "./pages.contract";

const selectPage = { id: pages.id, title: pages.title, slug: pages.slug, template: pages.template, status: pages.status, draftVersion: pages.draftVersion, seoTitle: pages.seoTitle, seoDescription: pages.seoDescription, canonicalUrl: pages.canonicalUrl, scheduledAt: pages.scheduledAt, publishedAt: pages.publishedAt, updatedAt: pages.updatedAt };

export async function findPageBySlug(slug: string, publishedOnly: boolean) {
  const now = new Date();
  const [page] = await getDb().select(selectPage).from(pages).where(and(eq(pages.slug, slug), isNull(pages.deletedAt), publishedOnly ? or(and(eq(pages.status, "published"), or(isNull(pages.publishedAt), lte(pages.publishedAt, now))), and(eq(pages.status, "scheduled"), lte(pages.scheduledAt, now))) : undefined)).limit(1);
  if (!page) return undefined;
  const blocks = await getDb().select({ type: pageBlocks.type, data: pageBlocks.data, isEnabled: pageBlocks.isEnabled }).from(pageBlocks).where(eq(pageBlocks.pageId, page.id)).orderBy(asc(pageBlocks.sortOrder));
  return { ...page, blocks };
}

export async function listAdminPages() {
  const result = await getDb().select(selectPage).from(pages).where(isNull(pages.deletedAt)).orderBy(desc(pages.updatedAt));
  return Promise.all(result.map(async page => ({ ...page, blocks: await getDb().select({ type: pageBlocks.type, data: pageBlocks.data, isEnabled: pageBlocks.isEnabled }).from(pageBlocks).where(eq(pageBlocks.pageId, page.id)).orderBy(asc(pageBlocks.sortOrder)) })));
}

export function listPublishedPageSummaries() {
  const now = new Date();
  return getDb().select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(and(isNull(pages.deletedAt), or(and(eq(pages.status, "published"), or(isNull(pages.publishedAt), lte(pages.publishedAt, now))), and(eq(pages.status, "scheduled"), lte(pages.scheduledAt, now)))));
}

export async function writePage(id: string | null, input: PageInput, editorId: string) {
  return getDb().transaction(async tx => {
    const [existing] = id ? await tx.select(selectPage).from(pages).where(and(eq(pages.id, id), isNull(pages.deletedAt))).for("update") : [];
    if (id && !existing) return undefined;
    const version = (existing?.draftVersion ?? 0) + 1;
    const publishedAt = input.status === "scheduled" ? input.scheduledAt : input.status === "published" ? existing?.publishedAt ?? new Date() : null;
    const values = { title: input.title, slug: input.slug, template: input.template, status: input.status, seoTitle: input.seoTitle, seoDescription: input.seoDescription, canonicalUrl: input.canonicalUrl, scheduledAt: input.scheduledAt, publishedAt, draftVersion: version };
    const [page] = id ? await tx.update(pages).set({ ...values, updatedAt: new Date() }).where(eq(pages.id, id)).returning({ id: pages.id }) : await tx.insert(pages).values(values).returning({ id: pages.id });
    await tx.delete(pageBlocks).where(eq(pageBlocks.pageId, page.id));
    if (input.blocks.length) await tx.insert(pageBlocks).values(input.blocks.map((block, index) => ({ pageId: page.id, type: block.type, data: block.data, sortOrder: index, isEnabled: block.isEnabled })));
    const snapshot = { ...input, publishedAt: publishedAt?.toISOString() ?? null };
    await tx.insert(pageRevisions).values({ pageId: page.id, editorId, versionNumber: version, snapshot, changeNote: id ? "Cập nhật trang trong CMS" : "Tạo trang trong CMS", isPublished: input.status === "published" });
    await tx.insert(auditLogs).values({ userId: editorId, action: id ? "page.update" : "page.create", entityType: "page", entityId: page.id, afterData: snapshot });
    return page.id;
  });
}
