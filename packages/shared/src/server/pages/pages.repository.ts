import { contentSeoSchema, contentSeoVisibilitySchema } from "../shared/content-seo";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, notInArray, or } from "drizzle-orm";
import { getDb } from "@iorder/shared/db/client";
import { auditLogs, pageBlocks, pageRevisions, pages } from "@iorder/shared/db/schema";
import { toAdminListPage, type AdminListQuery } from "@iorder/shared/server/shared/admin-list.contract";
import { fixedWebsitePages, type PageInput, type PageKindFilter } from "./pages.contract";
import { publicationDate } from "../shared/publication-date";
import { assertPageVersion } from "./page-version";
import { listOrder, workflowStatusRank, vietnameseText } from "../shared/list-order";
import { contentPathChange, pagePublicPath } from "../shared/content-paths";
import { applyContentPathChange } from "../redirects/redirects.repository";
import { liveContentCondition } from "../shared/live-content";

const selectPage = { id: pages.id, title: pages.title, slug: pages.slug, template: pages.template, status: pages.status, draftVersion: pages.draftVersion, seoTitle: pages.seoTitle, seoDescription: pages.seoDescription, canonicalUrl: pages.canonicalUrl, seo: pages.seo, scheduledAt: pages.scheduledAt, publishedAt: pages.publishedAt, updatedAt: pages.updatedAt };

async function withBlocks<T extends { id: string }>(page: T) {
  const blocks = await getDb().select({ type: pageBlocks.type, data: pageBlocks.data, isEnabled: pageBlocks.isEnabled, appearance: pageBlocks.appearance }).from(pageBlocks).where(eq(pageBlocks.pageId, page.id)).orderBy(asc(pageBlocks.sortOrder));
  return { ...page, blocks };
}

async function withBlocksBatch<T extends { id: string }>(pagesToHydrate: T[]) {
  if (!pagesToHydrate.length) return [];
  const blocks = await getDb().select({ pageId: pageBlocks.pageId, type: pageBlocks.type, data: pageBlocks.data, isEnabled: pageBlocks.isEnabled, appearance: pageBlocks.appearance }).from(pageBlocks).where(inArray(pageBlocks.pageId, pagesToHydrate.map((page) => page.id))).orderBy(asc(pageBlocks.sortOrder));
  const blocksByPage = new Map(pagesToHydrate.map((page) => [page.id, [] as Array<{ type: typeof pageBlocks.$inferSelect.type; data: typeof pageBlocks.$inferSelect.data; isEnabled: boolean; appearance: unknown }> ]));
  blocks.forEach(({ pageId, ...block }) => blocksByPage.get(pageId)?.push(block));
  return pagesToHydrate.map((page) => ({ ...page, blocks: blocksByPage.get(page.id) ?? [] }));
}

type PageListQuery = AdminListQuery & { status?: "draft" | "review" | "scheduled" | "published" | "archived"; kind?: PageKindFilter };
const fixedSlugs = fixedWebsitePages.map((page) => page.slug);
const standardSlugs = fixedWebsitePages.filter((page) => page.kind === "standard" && page.slug !== "home").map((page) => page.slug);
const listingSlugs = fixedWebsitePages.filter((page) => page.kind === "listing").map((page) => page.slug);

function pageKindCondition(kind: PageKindFilter | undefined) {
  switch (kind) {
    case "custom": return notInArray(pages.slug, fixedSlugs);
    case "system": return inArray(pages.slug, fixedSlugs);
    case "static": return ne(pages.slug, "home");
    case "standard": return inArray(pages.slug, standardSlugs);
    case "listing": return inArray(pages.slug, listingSlugs);
    default: return undefined;
  }
}

function pageListCondition(query: PageListQuery) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  return and(
    isNull(pages.deletedAt),
    query.status ? eq(pages.status, query.status) : undefined,
    pageKindCondition(query.kind),
    keyword ? or(ilike(pages.title, keyword), ilike(pages.slug, keyword)) : undefined,
  );
}

export async function findPageBySlug(slug: string, publishedOnly: boolean) {
  const [page] = await getDb().select(selectPage).from(pages).where(and(eq(pages.slug, slug), isNull(pages.deletedAt), publishedOnly ? liveContentCondition(pages) : undefined)).limit(1);
  if (!page) return undefined;
  const blocks = await getDb().select({ type: pageBlocks.type, data: pageBlocks.data, isEnabled: pageBlocks.isEnabled, appearance: pageBlocks.appearance }).from(pageBlocks).where(eq(pageBlocks.pageId, page.id)).orderBy(asc(pageBlocks.sortOrder));
  return { ...page, blocks };
}

export async function listAdminPages() {
  const result = await getDb().select(selectPage).from(pages).where(isNull(pages.deletedAt)).orderBy(desc(pages.updatedAt));
  return withBlocksBatch(result);
}

export async function listAdminPagesPage(query: PageListQuery, database = getDb()) {
  const condition = pageListCondition(query);
  return database.transaction(async tx => {
    const rows = await tx.select(selectPage).from(pages).where(condition).orderBy(...listOrder({ title: vietnameseText(pages.title), status: workflowStatusRank(pages.status), updatedAt: pages.updatedAt }, query, [desc(pages.updatedAt), asc(pages.id)])).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(pages).where(condition);
    // Danh sách không tải khối: màn danh sách chỉ cần thông tin dòng (P2-3 trong docs/CMS_V2_AUDIT.md).
    return toAdminListPage(rows, query, totals?.total ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function findAdminPageById(id: string) {
  const [page] = await getDb().select(selectPage).from(pages).where(and(eq(pages.id, id), isNull(pages.deletedAt))).limit(1);
  return page ? withBlocks(page) : undefined;
}

export function listPublishedPageSummaries() {
  return getDb().select({ slug: pages.slug, updatedAt: pages.updatedAt, seo: pages.seo }).from(pages).where(and(isNull(pages.deletedAt), liveContentCondition(pages))).then(rows => rows.map(row => ({ ...row, seo: contentSeoVisibilitySchema.parse(row.seo) })));
}

export async function listPublishedPages() {
  const result = await getDb().select(selectPage).from(pages).where(and(isNull(pages.deletedAt), liveContentCondition(pages))).orderBy(desc(pages.updatedAt));
  return withBlocksBatch(result);
}

export async function writePage(id: string | null, input: PageInput, editorId: string, expectedVersion?: number, database = getDb(), changeNote?: string) {
  return database.transaction(async tx => {
    const [existing] = id ? await tx.select(selectPage).from(pages).where(and(eq(pages.id, id), isNull(pages.deletedAt))).for("update") : [];
    if (id && !existing) return undefined;
    if (existing) assertPageVersion(existing.draftVersion, expectedVersion);
    const version = (existing?.draftVersion ?? 0) + 1;
    const publishedAt = publicationDate(input, existing, new Date());
    const seo = contentSeoSchema.parse(input.seo ?? existing?.seo ?? {});
    const values = { seo, title: input.title, slug: input.slug, template: input.template, status: input.status, seoTitle: input.seoTitle, seoDescription: input.seoDescription, canonicalUrl: input.canonicalUrl, scheduledAt: input.scheduledAt, publishedAt, draftVersion: version };
    const [page] = id ? await tx.update(pages).set({ ...values, updatedAt: new Date() }).where(eq(pages.id, id)).returning({ id: pages.id }) : await tx.insert(pages).values(values).returning({ id: pages.id });
    const pathChange = contentPathChange(existing && { status: existing.status, scheduledAt: existing.scheduledAt, path: pagePublicPath(existing.slug) }, { status: input.status, scheduledAt: input.scheduledAt, path: pagePublicPath(input.slug) });
    await applyContentPathChange(tx, pathChange, editorId);
    await tx.delete(pageBlocks).where(eq(pageBlocks.pageId, page.id));
    if (input.blocks.length) await tx.insert(pageBlocks).values(input.blocks.map((block, index) => ({ pageId: page.id, type: block.type, data: block.data, sortOrder: index, isEnabled: block.isEnabled, appearance: block.appearance ?? null })));
    const snapshot = { ...input, seo, publishedAt: publishedAt?.toISOString() ?? null };
    await tx.insert(pageRevisions).values({ pageId: page.id, editorId, versionNumber: version, snapshot, changeNote: changeNote ?? (id ? "Cập nhật trang trong CMS" : "Tạo trang trong CMS"), isPublished: input.status === "published" });
    await tx.insert(auditLogs).values({ userId: editorId, action: id ? "page.update" : "page.create", entityType: "page", entityId: page.id, afterData: snapshot });
    return page.id;
  });
}

export async function deleteArchivedPage(id: string, editorId: string, database = getDb(), options: { expectedVersion?: number } = {}) {
  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(pages)
      .where(and(eq(pages.id, id), eq(pages.status, "archived"), isNull(pages.deletedAt)))
      .for("update");
    if (!existing) return undefined;
    if (options.expectedVersion !== undefined) assertPageVersion(existing.draftVersion, options.expectedVersion);

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
