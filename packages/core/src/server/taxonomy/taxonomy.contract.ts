import { z } from "zod";

const slugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const categoryInputSchema = z.object({ parentId: z.string().uuid().nullable(), name: z.string().trim().min(1).max(160), slug: slugSchema, description: z.string().trim().max(10_000).nullable(), sortOrder: z.number().int().min(0).max(1_000_000) }).strict();
export const tagInputSchema = z.object({ name: z.string().trim().min(1).max(120), slug: slugSchema.max(140) }).strict();
export const taxonomyRequestSchema = z.object({ kind: z.enum(["categories", "tags"]), id: z.string().uuid().nullable(), values: z.unknown() }).strict();
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type TagInput = z.infer<typeof tagInputSchema>;
