import { z } from "zod";

export const partnerInputSchema = z.object({
  logoMediaId: z.string().uuid().nullable(), kind: z.enum(["partner", "customer"]), name: z.string().trim().min(1).max(180), description: z.string().trim().max(10_000).nullable(), websiteUrl: z.string().url().nullable(), sortOrder: z.number().int().min(0).max(10_000), isEnabled: z.boolean(),
}).strict();
export const testimonialInputSchema = z.object({
  avatarMediaId: z.string().uuid().nullable(), authorName: z.string().trim().min(1).max(180), authorRole: z.string().trim().max(180).nullable(), company: z.string().trim().max(180).nullable(), quote: z.string().trim().min(1).max(10_000), rating: z.number().int().min(1).max(5).nullable(), sortOrder: z.number().int().min(0).max(10_000), isEnabled: z.boolean(),
}).strict();
export type PartnerInput = z.infer<typeof partnerInputSchema>;
export type TestimonialInput = z.infer<typeof testimonialInputSchema>;
