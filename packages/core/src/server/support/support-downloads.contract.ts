import { z } from "zod";

export const publicSupportDownloadSchema = z
  .object({
    description: z.string().nullable(),
    downloadUrl: z.string().startsWith("/media/"),
    icon: z.string(),
    id: z.string().uuid(),
    meta: z.string().nullable(),
    title: z.string(),
  })
  .strict();

export const adminSupportDownloadInputSchema = z
  .object({
    fileMediaId: z.string().uuid().nullable(),
    icon: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(220),
    description: z.string().trim().min(1).max(10_000).nullable(),
    meta: z.string().trim().min(1).max(160).nullable(),
    sortOrder: z.number().int().min(0).max(10_000),
    isEnabled: z.boolean(),
  })
  .strict();

export const adminSupportDownloadSchema = adminSupportDownloadInputSchema
  .extend({
    id: z.string().uuid(),
    downloadUrl: z.string().startsWith("/media/").nullable(),
    originalName: z.string().nullable(),
    mimeType: z.string().nullable(),
    draftVersion: z.number().int().nonnegative(),
    archivedAt: z.string().datetime().nullable(),
    status: z.enum(["draft", "published", "archived"]),
  })
  .strict();

export const supportDownloadCreateRequestSchema = z.object({
  values: adminSupportDownloadInputSchema,
  changeNote: z.string().trim().max(500).optional(),
}).strict();

export const supportDownloadMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    values: adminSupportDownloadInputSchema,
    expectedVersion: z.number().int().nonnegative(),
    changeNote: z.string().trim().max(500).optional(),
  }).strict(),
  z.object({ action: z.literal("archive"), expectedVersion: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("restore"), expectedVersion: z.number().int().nonnegative() }).strict(),
]);

export type PublicSupportDownload = z.infer<typeof publicSupportDownloadSchema>;
export type AdminSupportDownload = z.infer<typeof adminSupportDownloadSchema>;
export type AdminSupportDownloadInput = z.infer<typeof adminSupportDownloadInputSchema>;
