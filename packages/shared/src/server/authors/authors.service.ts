import { z } from "zod";

import { findMediaAsset } from "../media/media.repository";
import { mediaPath } from "../media/storage";
import { getPublishedPostsByAuthor } from "../posts/posts.service";
import { authorInputSchema, publicAuthorSchema, type AdminAuthor, type PostAuthorProfile } from "./authors.contract";
import { deleteAuthor, findAuthorById, findEnabledAuthorBySlug, listAdminAuthors, listPublishedAuthorSummaries, saveAuthor } from "./authors.repository";

const avatarTypes = ["image/png", "image/jpeg", "image/webp"];

async function validateAvatarMedia(id: string | null) {
  if (!id) return;
  const asset = await findMediaAsset(id);
  if (!asset || !avatarTypes.includes(asset.mimeType)) throw new z.ZodError([{ code: "custom", path: ["avatarMediaId"], message: "Ảnh đại diện không tồn tại hoặc không đúng định dạng ảnh." }]);
}

export async function getAdminAuthors(): Promise<AdminAuthor[]> {
  return (await listAdminAuthors()).map(({ author, avatarKey, postCount }) => ({
    id: author.id, name: author.name, slug: author.slug, jobTitle: author.jobTitle, bio: author.bio, avatarMediaId: author.avatarMediaId,
    profileUrl: author.profileUrl, isEnabled: author.isEnabled, version: author.version, postCount, avatarUrl: avatarKey ? mediaPath(avatarKey) : null, updatedAt: author.updatedAt,
  }));
}

/** Ghi tác giả (tạo hoặc sửa). `onlyIfHidden`: người không có quyền xuất bản chỉ sửa được tác giả đang ẩn. */
export async function writeAuthor(id: string | null, input: unknown, userId: string, options: { expectedVersion?: number; onlyIfHidden?: boolean } = {}) {
  const values = authorInputSchema.parse(input);
  await validateAvatarMedia(values.avatarMediaId);
  return saveAuthor(id, values, userId, options);
}

export async function removeAuthor(id: string, userId: string) {
  return deleteAuthor(id, userId);
}

/** Trạng thái hiện tại của một tác giả (để route kiểm tra quyền xuất bản trước khi sửa). */
export async function getAuthorVisibility(id: string) {
  if (!z.string().uuid().safeParse(id).success) return undefined;
  return (await findAuthorById(id))?.author.isEnabled;
}

/** Hồ sơ gắn trên bài khi xem trước bản nháp trong CMS (chưa lưu nên không đi qua truy vấn công khai). */
export async function getAuthorProfileForPreview(id: string | null | undefined): Promise<PostAuthorProfile | null> {
  if (!id || !z.string().uuid().safeParse(id).success) return null;
  const row = await findAuthorById(id);
  if (!row) return null;
  return { slug: row.author.slug, name: row.author.name, jobTitle: row.author.jobTitle, profileUrl: row.author.profileUrl, avatarUrl: row.avatarKey ? mediaPath(row.avatarKey) : null, pageEnabled: row.author.isEnabled };
}

/**
 * Trang công khai của tác giả: chỉ khi đã bật trang và có ít nhất một bài đang hiển thị (trang không có bài là trang rỗng, không đáng để Google lập chỉ mục).
 * null: website trả 404.
 */
export async function getPublishedAuthorPage(slug: string) {
  const row = await findEnabledAuthorBySlug(slug);
  if (!row) return null;
  const posts = await getPublishedPostsByAuthor(row.author.id);
  if (!posts.length) return null;
  const author = publicAuthorSchema.parse({
    id: row.author.id, slug: row.author.slug, name: row.author.name, jobTitle: row.author.jobTitle, bio: row.author.bio, profileUrl: row.author.profileUrl,
    avatar: row.avatarKey ? { url: mediaPath(row.avatarKey), altText: row.avatarAlt } : null, updatedAt: row.author.updatedAt,
  });
  return { author, posts };
}

/** Tác giả có trang công khai (cho sitemap): đã bật và có bài đang hiển thị. */
export async function getPublishedAuthorSummaries() {
  return listPublishedAuthorSummaries();
}
