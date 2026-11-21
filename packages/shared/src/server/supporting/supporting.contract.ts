import { z } from "zod";
import { adminListQuerySchema } from "../shared/admin-list.contract";

export const partnerListQuerySchema = adminListQuerySchema.extend({
  visibility: z.enum(["all", "enabled", "disabled"]).default("all"),
  partnerKind: z.enum(["all", "partner", "customer"]).default("all"),
});
export const testimonialListQuerySchema = adminListQuerySchema.extend({
  visibility: z.enum(["all", "enabled", "disabled"]).default("all"),
});
export type PartnerListQuery = z.infer<typeof partnerListQuerySchema>;
export type TestimonialListQuery = z.infer<typeof testimonialListQuerySchema>;

export const partnerInputSchema = z.object({
  logoMediaId: z.string().uuid().nullable(), kind: z.enum(["partner", "customer"]), name: z.string().trim().min(1).max(180), description: z.string().trim().max(10_000).nullable(), websiteUrl: z.string().url().nullable(), sortOrder: z.number().int().min(0).max(10_000), isEnabled: z.boolean(),
}).strict();
export const testimonialInputSchema = z.object({
  avatarMediaId: z.string().uuid().nullable(), authorName: z.string().trim().min(1).max(180), authorRole: z.string().trim().max(180).nullable(), company: z.string().trim().max(180).nullable(), quote: z.string().trim().min(1).max(10_000), rating: z.number().int().min(1).max(5).nullable(), sortOrder: z.number().int().min(0).max(10_000), isEnabled: z.boolean(),
}).strict();
export type PartnerInput = z.infer<typeof partnerInputSchema>;
export type TestimonialInput = z.infer<typeof testimonialInputSchema>;
export const supportingSaveResponseSchema = z.object({ id: z.string().uuid() });

const supportingImageSchema = z.object({ url: z.string().min(1), altText: z.string().nullable() }).nullable();
// `version` chỉ có ở danh sách admin (optimistic concurrency), không có trong dữ liệu public.
export const partnerListItemSchema = partnerInputSchema.extend({ id: z.string().uuid(), version: z.number().int().nonnegative(), logo: supportingImageSchema }).strip();
export const testimonialListItemSchema = testimonialInputSchema.extend({ id: z.string().uuid(), version: z.number().int().nonnegative(), avatar: supportingImageSchema }).strip();

function supportingPageSchema<T extends z.ZodType<{ id: string }>>(item: T) {
  return z.object({
    items: z.array(item), page: z.number().int().positive(), pageSize: z.number().int().min(5).max(100),
    total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), totalPages: z.number().int().positive(),
  }).superRefine((value, ctx) => {
    const expected = Math.max(0, Math.min(value.pageSize, value.total - (value.page - 1) * value.pageSize));
    if (value.totalPages !== Math.max(1, Math.ceil(value.total / value.pageSize)) || value.items.length !== expected || new Set(value.items.map(row => row.id)).size !== value.items.length) {
      ctx.addIssue({ code: "custom", message: "Phản hồi phân trang nội dung thương hiệu không nhất quán." });
    }
  });
}
export const partnerListPageSchema = supportingPageSchema(partnerListItemSchema);
export const testimonialListPageSchema = supportingPageSchema(testimonialListItemSchema);
