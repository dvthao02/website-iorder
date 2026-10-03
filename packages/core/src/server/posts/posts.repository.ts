import { and, desc, eq, isNull, lte, or } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { auditLogs, categories, mediaAssets, postCategories, postRevisions, postTags, posts, tags } from "@iorder/core/db/schema";

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
  return Promise.all(rows.map(withTaxonomy));
}

export async function listPublishedPostsByTaxonomy(kind: "category" | "tag", slug: string) {
  const rows = kind === "category"
    ? await getDb().select({ id: posts.id, type: posts.type, title: posts.title, slug: posts.slug, excerpt: posts.excerpt, publishedAt: posts.publishedAt, createdAt: posts.createdAt, coverStorageKey: mediaAssets.storageKey, coverAltText: mediaAssets.altText }).from(posts).innerJoin(postCategories, eq(postCategories.postId, posts.id)).innerJoin(categories, eq(postCategories.categoryId, categories.id)).leftJoin(mediaAssets, eq(posts.coverMediaId, mediaAssets.id)).where(and(eq(categories.slug, slug), publicPostCondition())).orderBy(desc(posts.publishedAt), desc(posts.createdAt))
    : await getDb().select({ id: posts.id, type: posts.type, title: posts.title, slug: posts.slug, excerpt: posts.excerpt, publishedAt: posts.publishedAt, createdAt: posts.createdAt, coverStorageKey: mediaAssets.storageKey, coverAltText: mediaAssets.altText }).from(posts).innerJoin(postTags, eq(postTags.postId, posts.id)).innerJoin(tags, eq(postTags.tagId, tags.id)).leftJoin(mediaAssets, eq(posts.coverMediaId, mediaAssets.id)).where(and(eq(tags.slug, slug), publicPostCondition())).orderBy(desc(posts.publishedAt), desc(posts.createdAt));
  return Promise.all(rows.map(withTaxonomy));
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

export async function listAdminPosts() {
  return Promise.all((await getDb().select(adminPostSelection).from(posts).where(isNull(posts.deletedAt)).orderBy(desc(posts.updatedAt), desc(posts.createdAt))).map(withTaxonomy));
}

export async function findAdminPostById(id: string) {
  const [post] = await getDb().select(adminPostSelection).from(posts).where(and(eq(posts.id, id), isNull(posts.deletedAt))).limit(1);
  return post ? withTaxonomy(post) : undefined;
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
