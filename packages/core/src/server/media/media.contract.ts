import { z } from "zod";

export const mediaMetadataSchema = z.object({
  altText: z.string().trim().max(500).nullable(),
  caption: z.string().trim().max(10000).nullable(),
}).strict();

export const mediaAssetSchema = mediaMetadataSchema.extend({
  id: z.string().uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().nonnegative(),
  url: z.string().startsWith("/media/"),
});

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
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
