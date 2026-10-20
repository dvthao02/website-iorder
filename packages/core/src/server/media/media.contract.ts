import { z } from "zod";
import { adminListQuerySchema } from "../shared/admin-list.contract";
import { expectedVersionSchema } from "../shared/content-version";

export const mediaListQuerySchema = adminListQuerySchema.extend({
  // missing_alt: ảnh chưa có mô tả thay thế (để bổ sung cho SEO/trợ năng).
  type: z.enum(["all", "images", "documents", "missing_alt"]).default("all"),
}).strict();
export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;

export const mediaMetadataSchema = z.object({
  altText: z.string().trim().max(500).nullable(),
  caption: z.string().trim().max(10000).nullable(),
}).strict();
export const mediaMetadataUpdateSchema = mediaMetadataSchema.extend({ expectedVersion: expectedVersionSchema }).strict();

export const mediaAssetSchema = mediaMetadataSchema.extend({
  id: z.string().uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().nonnegative(),
  url: z.string().startsWith("/media/"),
  version: z.number().int().nonnegative(),
});

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export const mediaListResponseSchema = z.object({
  assets: z.array(mediaAssetSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(5).max(100),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
}).superRefine((page, context) => {
  if (page.assets.length > page.pageSize || page.assets.length > page.total || page.totalPages !== Math.max(1, Math.ceil(page.total / page.pageSize))) {
    context.addIssue({ code: "custom", path: ["assets"], message: "Thông tin phân trang tệp không nhất quán." });
  }
  if (new Set(page.assets.map(asset => asset.id)).size !== page.assets.length) {
    context.addIssue({ code: "custom", path: ["assets"], message: "Danh sách tệp có mã bị trùng." });
  }
});
export type MediaMetadata = z.infer<typeof mediaMetadataSchema>;

export const mediaUsageItemSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  label: z.string().min(1),
  location: z.string().min(1),
}).strict();

export const mediaUsageSchema = z.object({
  items: z.array(mediaUsageItemSchema),
  total: z.number().int().nonnegative(),
  canDelete: z.boolean(),
}).strict();

export type MediaUsage = z.infer<typeof mediaUsageItemSchema>;
