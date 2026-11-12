import { contentSeoSchema } from "../shared/content-seo";
import { adminPostInputSchema, adminPostListItemSchema, adminPostSchema, publicPostDetailSchema, publicPostSummarySchema, type AdminPost, type PublicPostType } from "./posts.contract";
import type { AdminListPage, AdminListQuery } from "@iorder/shared/server/shared/admin-list.contract";
import { validateCoverMedia, validateSeoMedia } from "../media/media.service";
import { publicationDate } from "../shared/publication-date";
import { assertContentVersion, contentStateAfterAction, contentStateChangeNotes, contentStateRequestSchema, ContentVersionConflictError, type ContentStateAction } from "../shared/content-version";
import { mediaPath } from "../media/storage";
import { contentPathChange, postPublicPath } from "../shared/content-paths";
import { ensureTaxonomyIds } from "@iorder/shared/server/taxonomy/taxonomy.service";
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

export async function getPublishedPostBySlug(slug: string, previewId?: string) {
  const post = await findPublishedPostBySlug(slug, previewId);

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
export async function getAdminPostsPage(query: AdminListQuery & { excludeType?: PublicPostType; status?: AdminPost["status"]; type?: PublicPostType; categoryId?: string; tagId?: string }): Promise<AdminListPage<AdminPost>> {
  const result = await listAdminPostsPage(query);
  return { ...result, items: adminPostSchema.array().parse(result.items.map(withoutTaxonomy)) };
}
export async function getAdminPostSummariesPage(query: Parameters<typeof listAdminPostSummariesPage>[0]) {
  const result = await listAdminPostSummariesPage(query);
  return { ...result, items: adminPostListItemSchema.array().parse(result.items.map(({ coverKey, ...row }) => ({ ...row, coverUrl: coverKey ? mediaPath(coverKey) : null }))) };
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
  await validateSeoMedia(values.seo);
  await ensureTaxonomyIds(values.categoryIds, values.tagIds);
  const publishedAt = values.status === "scheduled" ? values.scheduledAt : values.status === "published" ? new Date() : null;
  const snapshot = { ...values, authorId: editorId, publishedAt: publishedAt?.toISOString() ?? null };
  const id = await createPostWithRevision(
    { ...values, authorId: editorId, publishedAt },
    { editorId, versionNumber: 1, snapshot, changeNote: "Tạo bài viết trong CMS" },
    contentPathChange(undefined, { status: values.status, scheduledAt: values.scheduledAt, path: postPublicPath(values.slug, values.type) }),
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
  await validateSeoMedia(values.seo);
  await ensureTaxonomyIds(values.categoryIds, values.tagIds);
  const existing = await findAdminPostById(id);

  if (!existing) {
    return undefined;
  }

  values.seo ??= contentSeoSchema.parse(existing.seo ?? {});
  if (expectedVersion !== undefined) assertContentVersion(existing.draftVersion, expectedVersion);
  const publishedAt = publicationDate(values, existing, new Date());
  const versionNumber = existing.draftVersion + 1;
  const snapshot = { ...values, authorId: existing.authorId, coverMediaId: values.coverMediaId === undefined ? existing.coverMediaId : values.coverMediaId, publishedAt: publishedAt?.toISOString() ?? null };
  // Phiên bản đã khóa ở câu UPDATE nên `existing` đúng là bản trước khi lưu khi ghi thành công.
  const pathChange = contentPathChange(
    { status: existing.status, scheduledAt: existing.scheduledAt, path: postPublicPath(existing.slug, existing.type) },
    { status: values.status, scheduledAt: values.scheduledAt, path: postPublicPath(values.slug, values.type) },
  );
  const updatedId = await updatePostWithRevision(
    id,
    { ...values, publishedAt },
    { editorId, versionNumber, snapshot, changeNote },
    pathChange,
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

/** Đổi chuyên mục của bài (giữ nguyên mọi nội dung khác), có kiểm phiên bản và ghi lịch sử như khi lưu từ trình soạn. */
export async function changeAdminPostCategories(id: string, categoryIds: string[], editorId: string, expectedVersion: number) {
  const current = await findAdminPostById(id);
  if (!current) return undefined;
  assertContentVersion(current.draftVersion, expectedVersion);
  const values = Object.fromEntries(Object.keys(adminPostInputSchema.shape).map(key => [key, Reflect.get(current, key)]));
  return updateAdminPost(id, { ...values, categoryIds: [...new Set(categoryIds)] }, editorId, "Chuyển nhóm (chuyên mục) bài viết", expectedVersion);
}

export async function changeAdminPostState(id: string, action: ContentStateAction, editorId: string, expectedVersion: number) {
  contentStateRequestSchema.parse({ action, expectedVersion });
  const current = await findAdminPostById(id);
  if (!current) return undefined;
  const status = contentStateAfterAction(current, action, expectedVersion);
  const values = Object.fromEntries(Object.keys(adminPostInputSchema.shape).map(key => [key, Reflect.get(current, key)]));
  return updateAdminPost(id, { ...values, status }, editorId, `${contentStateChangeNotes[action]} bài viết`, expectedVersion);
}
