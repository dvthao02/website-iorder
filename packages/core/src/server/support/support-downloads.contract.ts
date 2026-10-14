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

export const supportDownloadListResponseSchema = z.object({
  downloads: z.array(adminSupportDownloadSchema.extend({
    // The CMS bridge revives *At JSON fields; preserve this contract's ISO string.
    archivedAt: z.preprocess(value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : value, z.string().datetime().nullable()),
  })).refine(rows => new Set(rows.map(row => row.id)).size === rows.length, "Danh sách tài nguyên có ID trùng."),
});

export function parseSavedSupportDownload(payload: unknown, expected: { id?: string; version: number; status: AdminSupportDownload["status"] }) {
  const parsed = z.object({ download: adminSupportDownloadSchema }).safeParse(payload);
  if (!parsed.success) return undefined;
  const download = parsed.data.download;
  if ((expected.id && download.id !== expected.id) || download.draftVersion !== expected.version || download.status !== expected.status) return undefined;
  return download;
}
