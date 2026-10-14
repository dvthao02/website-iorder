import { adminPostInputSchema, adminPostListItemSchema, adminPostSchema, publicPostDetailSchema, publicPostSummarySchema, type AdminPost, type PublicPostType } from "./posts.contract";
import type { AdminListPage, AdminListQuery } from "@iorder/core/server/shared/admin-list.contract";
import { validateCoverMedia } from "../media/media.service";
import { publicationDate } from "../shared/publication-date";
import { assertContentVersion, contentStateAfterAction, contentStateRequestSchema, ContentVersionConflictError } from "../shared/content-version";
import { mediaPath } from "../media/storage";
import { ensureTaxonomyIds } from "@iorder/core/server/taxonomy/taxonomy.service";
import {
  createPostWithRevision,
  deleteArchivedPost,
  findAdminPostById,
  findPublishedPostBySlug,
  listAdminPosts,
  listAdminPostsPage,
  listAdminPostSummariesPage,
  listPublishedPostDetails,
  listPublishedPosts,
  listPublishedPostsByTaxonomy,
  updatePostWithRevision,
} from "./posts.repository";

const postIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function withoutTaxonomyIds<T extends { categoryIds: string[]; tagIds: string[] }>(row: T) {
  const result = { ...row };
  Reflect.deleteProperty(result, "categoryIds");
  Reflect.deleteProperty(result, "tagIds");
  return result as Omit<T, "categoryIds" | "tagIds">;
}

function withoutTaxonomy<T extends { categories: unknown; tags: unknown }>(row: T) {
  const result = { ...row };
  Reflect.deleteProperty(result, "categories");
  Reflect.deleteProperty(result, "tags");
  return result as Omit<T, "categories" | "tags">;
}

function serializeCover<T extends { coverStorageKey: string | null; coverAltText: string | null; categoryIds: string[]; tagIds: string[] }>(row: T) {
  const { coverStorageKey, coverAltText, ...post } = withoutTaxonomyIds(row);
  return { ...post, cover: coverStorageKey ? { url: mediaPath(coverStorageKey), altText: coverAltText } : null };
}

export async function getPublishedPostSummaries(type?: PublicPostType) {
  const rows = await listPublishedPosts(type);

  return publicPostSummarySchema.array().parse(rows.map(serializeCover));
}

export async function getPublishedPostBySlug(slug: string) {
  const post = await findPublishedPostBySlug(slug);

  return post ? publicPostDetailSchema.parse(serializeCover(post)) : undefined;
}
export async function getPublishedPostDetails(type?: PublicPostType) {
  return publicPostDetailSchema.array().parse((await listPublishedPostDetails(type)).map(serializeCover));
}
export async function getPublishedPostsByTaxonomy(kind: "category" | "tag", slug: string) {
  return publicPostSummarySchema.array().parse((await listPublishedPostsByTaxonomy(kind, slug)).map(serializeCover));
}

export async function getAdminPosts() {
  return adminPostSchema.array().parse((await listAdminPosts()).map(withoutTaxonomy));
}
export async function getAdminPostsPage(query: AdminListQuery & { excludeType?: PublicPostType; status?: AdminPost["status"]; type?: PublicPostType }): Promise<AdminListPage<AdminPost>> {
  const result = await listAdminPostsPage(query);
  return { ...result, items: adminPostSchema.array().parse(result.items.map(withoutTaxonomy)) };
}
export async function getAdminPostSummariesPage(query: Parameters<typeof listAdminPostSummariesPage>[0]) {
  const result = await listAdminPostSummariesPage(query);
  return { ...result, items: adminPostListItemSchema.array().parse(result.items) };
}

export async function getAdminPostById(id: string) {
  if (!postIdPattern.test(id)) return undefined;
  const post = await findAdminPostById(id);
  return post ? adminPostSchema.parse(withoutTaxonomy(post)) : undefined;
}

export async function deleteArchivedAdminPost(id: string, editorId: string, expectedVersion: number) {
  if (!postIdPattern.test(id)) return undefined;
  return deleteArchivedPost(id, editorId, expectedVersion);
}

export async function createAdminPost(input: unknown, editorId: string) {
  const values = adminPostInputSchema.parse(input);
  await validateCoverMedia(values.coverMediaId);
  await ensureTaxonomyIds(values.categoryIds, values.tagIds);
  const publishedAt = values.status === "scheduled" ? values.scheduledAt : values.status === "published" ? new Date() : null;
  const snapshot = { ...values, authorId: editorId, publishedAt: publishedAt?.toISOString() ?? null };
  const id = await createPostWithRevision(
    { ...values, authorId: editorId, publishedAt },
    { editorId, versionNumber: 1, snapshot, changeNote: "Tạo bài viết trong CMS" },
  );
  const post = await findAdminPostById(id);

  if (!post) {
    throw new Error("Không thể đọc bài viết vừa tạo.");
  }

  return adminPostSchema.parse(withoutTaxonomy(post));
}

export async function updateAdminPost(id: string, input: unknown, editorId: string, changeNote = "Cập nhật bài viết trong CMS", expectedVersion?: number) {
  const values = adminPostInputSchema.parse(input);
  await validateCoverMedia(values.coverMediaId);
  await ensureTaxonomyIds(values.categoryIds, values.tagIds);
  const existing = await findAdminPostById(id);

  if (!existing) {
    return undefined;
  }

  if (expectedVersion !== undefined) assertContentVersion(existing.draftVersion, expectedVersion);
  const publishedAt = publicationDate(values, existing, new Date());
  const versionNumber = existing.draftVersion + 1;
  const snapshot = { ...values, authorId: existing.authorId, coverMediaId: values.coverMediaId === undefined ? existing.coverMediaId : values.coverMediaId, publishedAt: publishedAt?.toISOString() ?? null };
  const updatedId = await updatePostWithRevision(
    id,
    { ...values, publishedAt },
    { editorId, versionNumber, snapshot, changeNote },
  );

  if (!updatedId) {
    throw new ContentVersionConflictError();
  }

  const post = await findAdminPostById(updatedId);

  if (!post) {
    throw new Error("Không thể đọc bài viết vừa cập nhật.");
  }

  return adminPostSchema.parse(withoutTaxonomy(post));
}

export async function changeAdminPostState(id: string, action: "archive" | "restore", editorId: string, expectedVersion: number) {
  contentStateRequestSchema.parse({ action, expectedVersion });
  const current = await findAdminPostById(id);
  if (!current) return undefined;
  const status = contentStateAfterAction(current, action, expectedVersion);
  const values = Object.fromEntries(Object.keys(adminPostInputSchema.shape).map(key => [key, Reflect.get(current, key)]));
  return updateAdminPost(id, { ...values, status }, editorId, action === "archive" ? "Lưu trữ bài viết" : "Khôi phục bài viết về bản nháp", expectedVersion);
}
