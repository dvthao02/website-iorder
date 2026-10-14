import { and, asc, count, desc, eq, ilike, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, pageBlocks, pageRevisions, pages } from "@iorder/core/db/schema";
import { toAdminListPage, type AdminListQuery } from "@iorder/core/server/shared/admin-list.contract";
import type { PageInput } from "./pages.contract";
import { publicationDate } from "../shared/publication-date";
import { assertPageVersion } from "./page-version";

const selectPage = { id: pages.id, title: pages.title, slug: pages.slug, template: pages.template, status: pages.status, draftVersion: pages.draftVersion, seoTitle: pages.seoTitle, seoDescription: pages.seoDescription, canonicalUrl: pages.canonicalUrl, scheduledAt: pages.scheduledAt, publishedAt: pages.publishedAt, updatedAt: pages.updatedAt };

async function withBlocks<T extends { id: string }>(page: T) {
  const blocks = await getDb().select({ type: pageBlocks.type, data: pageBlocks.data, isEnabled: pageBlocks.isEnabled }).from(pageBlocks).where(eq(pageBlocks.pageId, page.id)).orderBy(asc(pageBlocks.sortOrder));
  return { ...page, blocks };
}

async function withBlocksBatch<T extends { id: string }>(pagesToHydrate: T[]) {
  if (!pagesToHydrate.length) return [];
  const blocks = await getDb().select({ pageId: pageBlocks.pageId, type: pageBlocks.type, data: pageBlocks.data, isEnabled: pageBlocks.isEnabled }).from(pageBlocks).where(inArray(pageBlocks.pageId, pagesToHydrate.map((page) => page.id))).orderBy(asc(pageBlocks.sortOrder));
  const blocksByPage = new Map(pagesToHydrate.map((page) => [page.id, [] as Array<{ type: typeof pageBlocks.$inferSelect.type; data: typeof pageBlocks.$inferSelect.data; isEnabled: boolean }> ]));
  blocks.forEach(({ pageId, ...block }) => blocksByPage.get(pageId)?.push(block));
  return pagesToHydrate.map((page) => ({ ...page, blocks: blocksByPage.get(page.id) ?? [] }));
}

type PageListQuery = AdminListQuery & { status?: "draft" | "review" | "scheduled" | "published" | "archived" };

function pageListCondition(query: PageListQuery) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  return and(
    isNull(pages.deletedAt),
    query.status ? eq(pages.status, query.status) : undefined,
    keyword ? or(ilike(pages.title, keyword), ilike(pages.slug, keyword)) : undefined,
  );
}

export async function findPageBySlug(slug: string, publishedOnly: boolean) {
  const now = new Date();
  const [page] = await getDb().select(selectPage).from(pages).where(and(eq(pages.slug, slug), isNull(pages.deletedAt), publishedOnly ? or(and(eq(pages.status, "published"), or(isNull(pages.publishedAt), lte(pages.publishedAt, now))), and(eq(pages.status, "scheduled"), lte(pages.scheduledAt, now))) : undefined)).limit(1);
  if (!page) return undefined;
  const blocks = await getDb().select({ type: pageBlocks.type, data: pageBlocks.data, isEnabled: pageBlocks.isEnabled }).from(pageBlocks).where(eq(pageBlocks.pageId, page.id)).orderBy(asc(pageBlocks.sortOrder));
  return { ...page, blocks };
}

export async function listAdminPages() {
  const result = await getDb().select(selectPage).from(pages).where(isNull(pages.deletedAt)).orderBy(desc(pages.updatedAt));
  return withBlocksBatch(result);
}

export async function listAdminPagesPage(query: PageListQuery, database = getDb()) {
  const condition = pageListCondition(query);
  return database.transaction(async tx => {
    const rows = await tx.select(selectPage).from(pages).where(condition).orderBy(desc(pages.updatedAt), asc(pages.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(pages).where(condition);
    const blocks = rows.length ? await tx.select({ pageId: pageBlocks.pageId, type: pageBlocks.type, data: pageBlocks.data, isEnabled: pageBlocks.isEnabled }).from(pageBlocks).where(inArray(pageBlocks.pageId, rows.map(page => page.id))).orderBy(asc(pageBlocks.sortOrder), asc(pageBlocks.id)) : [];
    const blocksByPage = new Map(rows.map(page => [page.id, [] as Array<{ type: typeof pageBlocks.$inferSelect.type; data: typeof pageBlocks.$inferSelect.data; isEnabled: boolean }>]));
    blocks.forEach(({ pageId, ...block }) => blocksByPage.get(pageId)?.push(block));
    return toAdminListPage(rows.map(page => ({ ...page, blocks: blocksByPage.get(page.id) ?? [] })), query, totals?.total ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function findAdminPageById(id: string) {
  const [page] = await getDb().select(selectPage).from(pages).where(and(eq(pages.id, id), isNull(pages.deletedAt))).limit(1);
  return page ? withBlocks(page) : undefined;
}

export function listPublishedPageSummaries() {
  const now = new Date();
  return getDb().select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(and(isNull(pages.deletedAt), or(and(eq(pages.status, "published"), or(isNull(pages.publishedAt), lte(pages.publishedAt, now))), and(eq(pages.status, "scheduled"), lte(pages.scheduledAt, now)))));
}

export async function listPublishedPages() {
  const now = new Date();
  const result = await getDb().select(selectPage).from(pages).where(and(isNull(pages.deletedAt), or(and(eq(pages.status, "published"), or(isNull(pages.publishedAt), lte(pages.publishedAt, now))), and(eq(pages.status, "scheduled"), lte(pages.scheduledAt, now))))).orderBy(desc(pages.updatedAt));
  return withBlocksBatch(result);
}

export async function writePage(id: string | null, input: PageInput, editorId: string, expectedVersion?: number, database = getDb()) {
  return database.transaction(async tx => {
    const [existing] = id ? await tx.select(selectPage).from(pages).where(and(eq(pages.id, id), isNull(pages.deletedAt))).for("update") : [];
    if (id && !existing) return undefined;
    if (existing) assertPageVersion(existing.draftVersion, expectedVersion);
    const version = (existing?.draftVersion ?? 0) + 1;
    const publishedAt = publicationDate(input, existing, new Date());
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

export async function deleteArchivedPage(id: string, editorId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(pages)
      .where(and(eq(pages.id, id), eq(pages.status, "archived"), isNull(pages.deletedAt)))
      .for("update");
    if (!existing) return undefined;

    const [deleted] = await tx
      .update(pages)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(pages.id, id))
      .returning({ id: pages.id, slug: pages.slug });
    if (!deleted) return undefined;

    await tx.insert(auditLogs).values({
      userId: editorId,
      action: "page.delete",
      entityType: "page",
      entityId: deleted.id,
      beforeData: existing,
    });
    return deleted;
  });
}
