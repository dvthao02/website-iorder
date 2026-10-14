import { and, asc, count, desc, eq, ilike, inArray, isNull, lte, ne, or } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { assertContentVersion, contentDeleteRequestSchema } from "../shared/content-version";
import { auditLogs, categories, mediaAssets, postCategories, postRevisions, postTags, posts, tags } from "@iorder/core/db/schema";
import { toAdminListPage, type AdminListQuery } from "@iorder/core/server/shared/admin-list.contract";

import type { AdminPostInput, PublicPostType } from "./posts.contract";

function publicPostCondition() {
  const now = new Date();

  return and(
    isNull(posts.deletedAt),
    or(
      and(eq(posts.status, "published"), or(isNull(posts.publishedAt), lte(posts.publishedAt, now))),
      and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, now)),
    ),
  );
}

async function postTaxonomy(postId: string) {
  const [postCategoriesRows, postTagsRows] = await Promise.all([
    getDb().select({ id: categories.id, name: categories.name, slug: categories.slug }).from(postCategories).innerJoin(categories, eq(postCategories.categoryId, categories.id)).where(eq(postCategories.postId, postId)),
    getDb().select({ id: tags.id, name: tags.name, slug: tags.slug }).from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id)).where(eq(postTags.postId, postId)),
  ]);
  return { categories: postCategoriesRows, tags: postTagsRows, categoryIds: postCategoriesRows.map(row => row.id), tagIds: postTagsRows.map(row => row.id) };
}
async function withTaxonomy<T extends { id: string }>(row: T) { return { ...row, ...(await postTaxonomy(row.id)) }; }

async function withTaxonomyBatch<T extends { id: string }>(rows: T[], database: Pick<ReturnType<typeof getDb>, "select"> = getDb()) {
  if (!rows.length) return [];
  const postIds = rows.map((row) => row.id);
  const [categoryRows, tagRows] = await Promise.all([
    database.select({ postId: postCategories.postId, id: categories.id, name: categories.name, slug: categories.slug }).from(postCategories).innerJoin(categories, eq(postCategories.categoryId, categories.id)).where(inArray(postCategories.postId, postIds)),
    database.select({ postId: postTags.postId, id: tags.id, name: tags.name, slug: tags.slug }).from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id)).where(inArray(postTags.postId, postIds)),
  ]);
  const taxonomyByPost = new Map(postIds.map((id) => [id, { categories: [] as Array<{ id: string; name: string; slug: string }>, tags: [] as Array<{ id: string; name: string; slug: string }> }]));
  categoryRows.forEach(({ postId, ...category }) => taxonomyByPost.get(postId)?.categories.push(category));
  tagRows.forEach(({ postId, ...tag }) => taxonomyByPost.get(postId)?.tags.push(tag));
  return rows.map((row) => {
    const taxonomy = taxonomyByPost.get(row.id) ?? { categories: [], tags: [] };
    return { ...row, ...taxonomy, categoryIds: taxonomy.categories.map((category) => category.id), tagIds: taxonomy.tags.map((tag) => tag.id) };
  });
}

export async function listPublishedPosts(type?: PublicPostType) {
  const rows = await getDb()
    .select({
      id: posts.id,
      type: posts.type,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      coverStorageKey: mediaAssets.storageKey,
      coverAltText: mediaAssets.altText,
    })
    .from(posts)
    .leftJoin(mediaAssets, eq(posts.coverMediaId, mediaAssets.id))
    .where(type ? and(publicPostCondition(), eq(posts.type, type)) : publicPostCondition())
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt));
  return withTaxonomyBatch(rows);
}

export async function listPublishedPostsByTaxonomy(kind: "category" | "tag", slug: string) {
  const rows = kind === "category"
    ? await getDb().select({ id: posts.id, type: posts.type, title: posts.title, slug: posts.slug, excerpt: posts.excerpt, publishedAt: posts.publishedAt, createdAt: posts.createdAt, coverStorageKey: mediaAssets.storageKey, coverAltText: mediaAssets.altText }).from(posts).innerJoin(postCategories, eq(postCategories.postId, posts.id)).innerJoin(categories, eq(postCategories.categoryId, categories.id)).leftJoin(mediaAssets, eq(posts.coverMediaId, mediaAssets.id)).where(and(eq(categories.slug, slug), publicPostCondition())).orderBy(desc(posts.publishedAt), desc(posts.createdAt))
    : await getDb().select({ id: posts.id, type: posts.type, title: posts.title, slug: posts.slug, excerpt: posts.excerpt, publishedAt: posts.publishedAt, createdAt: posts.createdAt, coverStorageKey: mediaAssets.storageKey, coverAltText: mediaAssets.altText }).from(posts).innerJoin(postTags, eq(postTags.postId, posts.id)).innerJoin(tags, eq(postTags.tagId, tags.id)).leftJoin(mediaAssets, eq(posts.coverMediaId, mediaAssets.id)).where(and(eq(tags.slug, slug), publicPostCondition())).orderBy(desc(posts.publishedAt), desc(posts.createdAt));
  return withTaxonomyBatch(rows);
}

export async function findPublishedPostBySlug(slug: string) {
  const [post] = await getDb()
    .select({
      id: posts.id,
      type: posts.type,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      content: posts.content,
      seoTitle: posts.seoTitle,
      seoDescription: posts.seoDescription,
      canonicalUrl: posts.canonicalUrl,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      coverStorageKey: mediaAssets.storageKey,
      coverAltText: mediaAssets.altText,
    })
    .from(posts)
    .leftJoin(mediaAssets, eq(posts.coverMediaId, mediaAssets.id))
    .where(and(eq(posts.slug, slug), publicPostCondition()))
    .limit(1);

  return post ? withTaxonomy(post) : undefined;
}

const adminPostSelection = {
  id: posts.id,
  authorId: posts.authorId,
  coverMediaId: posts.coverMediaId,
  type: posts.type,
  title: posts.title,
  slug: posts.slug,
  excerpt: posts.excerpt,
  content: posts.content,
  status: posts.status,
  draftVersion: posts.draftVersion,
  seoTitle: posts.seoTitle,
  seoDescription: posts.seoDescription,
  canonicalUrl: posts.canonicalUrl,
  promotionStartAt: posts.promotionStartAt,
  promotionEndAt: posts.promotionEndAt,
  ctaLabel: posts.ctaLabel,
  ctaUrl: posts.ctaUrl,
  badgeText: posts.badgeText,
  scheduledAt: posts.scheduledAt,
  publishedAt: posts.publishedAt,
  updatedAt: posts.updatedAt,
};

type PostListQuery = AdminListQuery & {
  excludeType?: PublicPostType;
  status?: "draft" | "review" | "scheduled" | "published" | "archived";
  type?: PublicPostType;
};

function postListCondition(query: PostListQuery) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  return and(
    isNull(posts.deletedAt),
    query.type ? eq(posts.type, query.type) : undefined,
    query.excludeType ? ne(posts.type, query.excludeType) : undefined,
    query.status ? eq(posts.status, query.status) : undefined,
    keyword ? or(ilike(posts.title, keyword), ilike(posts.slug, keyword)) : undefined,
  );
}

const publishedPostDetailSelection = {
  id: posts.id,
  type: posts.type,
  title: posts.title,
  slug: posts.slug,
  excerpt: posts.excerpt,
  content: posts.content,
  seoTitle: posts.seoTitle,
  seoDescription: posts.seoDescription,
  canonicalUrl: posts.canonicalUrl,
  publishedAt: posts.publishedAt,
  createdAt: posts.createdAt,
  coverStorageKey: mediaAssets.storageKey,
  coverAltText: mediaAssets.altText,
};

export async function listPublishedPostDetails(type?: PublicPostType) {
  const rows = await getDb()
    .select(publishedPostDetailSelection)
    .from(posts)
    .leftJoin(mediaAssets, eq(posts.coverMediaId, mediaAssets.id))
    .where(type ? and(publicPostCondition(), eq(posts.type, type)) : publicPostCondition())
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt));
  return withTaxonomyBatch(rows);
}

export async function listAdminPosts() {
  return withTaxonomyBatch(await getDb().select(adminPostSelection).from(posts).where(isNull(posts.deletedAt)).orderBy(desc(posts.updatedAt), desc(posts.createdAt)));
}

export async function listAdminPostsPage(query: PostListQuery, database = getDb()) {
  const condition = postListCondition(query);
  return database.transaction(async (tx) => {
    const rows = await tx.select(adminPostSelection).from(posts).where(condition).orderBy(desc(posts.updatedAt), desc(posts.createdAt), asc(posts.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(posts).where(condition);
    return toAdminListPage(await withTaxonomyBatch(rows, tx), query, totals?.total ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function findAdminPostById(id: string) {
  const [post] = await getDb().select(adminPostSelection).from(posts).where(and(eq(posts.id, id), isNull(posts.deletedAt))).limit(1);
  return post ? withTaxonomy(post) : undefined;
}

export async function listAdminPostSummariesPage(query: PostListQuery, database = getDb()) {
  const condition = postListCondition(query);
  return database.transaction(async tx => {
    const rows = await tx.select({ id: posts.id, type: posts.type, title: posts.title, slug: posts.slug, status: posts.status, draftVersion: posts.draftVersion, updatedAt: posts.updatedAt })
      .from(posts).where(condition).orderBy(desc(posts.updatedAt), desc(posts.createdAt), asc(posts.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(posts).where(condition);
    return toAdminListPage(rows, query, totals?.total ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

type PostRevisionWrite = {
  changeNote: string;
  editorId: string;
  snapshot: unknown;
  versionNumber: number;
};

export async function createPostWithRevision(
  values: AdminPostInput & { authorId: string; publishedAt: Date | null },
  revision: PostRevisionWrite,
) {
  return getDb().transaction(async (tx) => {
    const { categoryIds, tagIds, ...postValues } = values;
    const [created] = await tx.insert(posts).values({ ...postValues, draftVersion: revision.versionNumber }).returning({ id: posts.id });

    if (!created) {
      throw new Error("Không thể tạo bài viết.");
    }
    if (categoryIds.length) await tx.insert(postCategories).values(categoryIds.map(categoryId => ({ postId: created.id, categoryId })));
    if (tagIds.length) await tx.insert(postTags).values(tagIds.map(tagId => ({ postId: created.id, tagId })));

    await tx.insert(postRevisions).values({
      postId: created.id,
      editorId: revision.editorId,
      versionNumber: revision.versionNumber,
      snapshot: revision.snapshot,
      changeNote: revision.changeNote,
    });
    await tx.insert(auditLogs).values({
      userId: revision.editorId,
      action: "post.create",
      entityType: "post",
      entityId: created.id,
      afterData: revision.snapshot,
    });

    return created.id;
  });
}

export async function updatePostWithRevision(
  id: string,
  values: AdminPostInput & { publishedAt: Date | null },
  revision: PostRevisionWrite,
) {
  return getDb().transaction(async (tx) => {
    const { categoryIds, tagIds, ...postValues } = values;
    const [updated] = await tx
      .update(posts)
      .set({ ...postValues, draftVersion: revision.versionNumber, updatedAt: new Date() })
      .where(and(eq(posts.id, id), isNull(posts.deletedAt), eq(posts.draftVersion, revision.versionNumber - 1)))
      .returning({ id: posts.id });

    if (!updated) {
      return undefined;
    }
    await tx.delete(postCategories).where(eq(postCategories.postId, id));
    await tx.delete(postTags).where(eq(postTags.postId, id));
    if (categoryIds.length) await tx.insert(postCategories).values(categoryIds.map(categoryId => ({ postId: id, categoryId })));
    if (tagIds.length) await tx.insert(postTags).values(tagIds.map(tagId => ({ postId: id, tagId })));

    await tx.insert(postRevisions).values({
      postId: updated.id,
      editorId: revision.editorId,
      versionNumber: revision.versionNumber,
      snapshot: revision.snapshot,
      changeNote: revision.changeNote,
    });
    await tx.insert(auditLogs).values({
      userId: revision.editorId,
      action: "post.update",
      entityType: "post",
      entityId: updated.id,
      afterData: revision.snapshot,
    });

    return updated.id;
  });
}

/** Chỉ đưa bản đã lưu trữ ra khỏi danh sách CMS; lịch sử và audit vẫn được giữ lại. */
export async function deleteArchivedPost(id: string, editorId: string, expectedVersion: number, database?: ReturnType<typeof getDb>) {
  contentDeleteRequestSchema.parse({ expectedVersion });
  return (database ?? getDb()).transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(posts)
      .where(and(eq(posts.id, id), eq(posts.status, "archived"), isNull(posts.deletedAt)))
      .for("update");
    if (!existing) return undefined;
    assertContentVersion(existing.draftVersion, expectedVersion);

    const [deleted] = await tx
      .update(posts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(posts.id, id), eq(posts.draftVersion, expectedVersion), eq(posts.status, "archived"), isNull(posts.deletedAt)))
      .returning({ id: posts.id, slug: posts.slug, type: posts.type });
    if (!deleted) return undefined;

    await tx.insert(auditLogs).values({
      userId: editorId,
      action: "post.delete",
      entityType: "post",
      entityId: deleted.id,
      beforeData: existing,
    });
    return deleted;
  });
}
