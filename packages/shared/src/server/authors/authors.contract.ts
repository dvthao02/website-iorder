import { z } from "zod";

import { expectedVersionSchema } from "../shared/content-version";

const slugSchema = z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
// Ô trống trong CMS gửi lên "" hoặc null đều là "không có".
const optionalText = (max: number) => z.string().trim().max(max).nullable().transform((value) => value || null);
const httpUrl = z.string().trim().url().max(2000).refine((value) => /^https?:\/\//i.test(value), "Dùng địa chỉ bắt đầu bằng http:// hoặc https://.");

/** Hồ sơ tác giả công khai. `isEnabled`: bật thì trang riêng /tac-gia/<slug> hiện trên website (cần có bài đã xuất bản). */
export const authorInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  jobTitle: optionalText(120),
  bio: optionalText(2000),
  avatarMediaId: z.string().uuid().nullable(),
  profileUrl: httpUrl.nullable(),
  isEnabled: z.boolean(),
}).strict();
export type AuthorInput = z.infer<typeof authorInputSchema>;

export const authorRequestSchema = z.object({
  id: z.string().uuid().nullable(),
  values: z.unknown(),
  expectedVersion: expectedVersionSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.id && value.expectedVersion === undefined) context.addIssue({ code: "custom", path: ["expectedVersion"], message: "Vui lòng tải lại để lấy phiên bản trước khi lưu." });
});

/** Dòng trong CMS: kèm số bài đang dùng tác giả này và địa chỉ ảnh đại diện. */
export type AdminAuthor = AuthorInput & { id: string; version: number; postCount: number; avatarUrl: string | null; updatedAt: Date };

/** Tác giả công khai trên trang /tac-gia/<slug>. */
export const publicAuthorSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  jobTitle: z.string().nullable(),
  bio: z.string().nullable(),
  profileUrl: z.string().nullable(),
  avatar: z.object({ url: z.string(), altText: z.string().nullable() }).nullable(),
  updatedAt: z.date(),
}).strict();
export type PublicAuthor = z.infer<typeof publicAuthorSchema>;

/** Tác giả gắn trên một bài viết (dòng "Tác giả" và dữ liệu cấu trúc). `pageEnabled`: có trang riêng để liên kết tới hay không. */
export const postAuthorProfileSchema = z.object({
  slug: z.string(),
  name: z.string(),
  jobTitle: z.string().nullable(),
  profileUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  pageEnabled: z.boolean(),
}).strict();
export type PostAuthorProfile = z.infer<typeof postAuthorProfileSchema>;

/** Đường dẫn công khai của trang tác giả (một chỗ duy nhất cho website, sitemap, CMS). */
export function authorPublicPath(slug: string) {
  return `/tac-gia/${slug}`;
}
