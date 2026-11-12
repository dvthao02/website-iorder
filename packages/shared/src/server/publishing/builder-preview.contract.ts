import { equipmentInputSchema } from "../equipment/equipment.contract";
import { z } from "zod";
import { pageInputSchema } from "../pages/pages.contract";
import { adminOfferingInputSchema } from "../offerings/offering-content.contract";

export const builderPreviewDocumentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page"), values: pageInputSchema }).strict(),
  z.object({ kind: z.literal("offering"), values: adminOfferingInputSchema }).strict(),
  z.object({ kind: z.literal("equipment"), values: equipmentInputSchema }).strict(),
]);
export const builderPreviewRequestSchema = z.object({
  previewId: z.string().uuid(),
  documentId: z.string().uuid().nullable(),
  sequence: z.number().int().min(1).max(2147483647),
  parentOrigin: z.string().url().max(500).refine(value => /^https?:\/\//i.test(value) && new URL(value).origin === value, "Nguồn CMS không hợp lệ."),
  document: builderPreviewDocumentSchema,
}).strict();
export const builderPreviewResponseSchema = z.object({ token: z.string().min(1).max(512), sequence: z.number().int().positive() }).strict();
export const builderPreviewReadSchema = z.object({
  id: z.string().uuid(), documentId: z.string().uuid().nullable(), document: builderPreviewDocumentSchema,
  parentOrigin: builderPreviewRequestSchema.shape.parentOrigin,
  path: z.string().startsWith("/").refine(value => !value.startsWith("//") && !value.includes("\\") && !/[\r\n]/.test(value)),
  expiresAt: z.coerce.date(),
}).strict();
export const builderSelectionMessageSchema = z.object({ type: z.literal("iorder:select-block"), index: z.number().int().min(0).max(99) }).strict();
export type BuilderPreviewDocument = z.infer<typeof builderPreviewDocumentSchema>;
export type BuilderPreviewRequest = z.infer<typeof builderPreviewRequestSchema>;
export const builderPreviewTtlMs = 15 * 60 * 1000;
