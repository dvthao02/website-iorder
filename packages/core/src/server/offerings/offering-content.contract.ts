import { z } from "zod";

const shortTextSchema = z.string().trim().min(1).max(500);

export const publicOfferingTypeSchema = z.enum(["software", "solution", "service", "industry"]);
export const offeringSlugSchema = z.string().trim().min(1).max(180);

export const offeringContentSchema = z
  .object({
    description: z.string().trim().min(1).max(20_000),
    tags: z.array(shortTextSchema).max(50),
    bestFor: z.string().trim().min(1).max(500).nullable(),
    keyValue: z.string().trim().min(1).max(500).nullable(),
    metrics: z.array(shortTextSchema).max(50),
    features: z.array(shortTextSchema).max(100),
    benefits: z.array(shortTextSchema).max(100),
    faq: z.array(z.tuple([shortTextSchema, shortTextSchema])).max(50),
    items: z.array(z.union([shortTextSchema, z.object({ title: shortTextSchema, href: z.string().regex(/^(\/(?!\/)|https?:\/\/)/) }).strict()])).max(100),
    category: z.string().trim().min(1).max(180).nullable(),
  })
  .strict();

export const publicOfferingSummarySchema = z
  .object({
    id: z.string().uuid(),
    type: publicOfferingTypeSchema,
    title: z.string(),
    slug: z.string(),
    summary: z.string().nullable(),
    icon: z.string().nullable(),
    isFeatured: z.boolean(),
    sortOrder: z.number().int(),
    publishedAt: z.date().nullable(),
    cover: z
      .object({
        altText: z.string().nullable(),
        height: z.number().int().positive().nullable(),
        url: z.string().startsWith("/media/"),
        width: z.number().int().positive().nullable(),
      })
      .nullable(),
  })
  .strict();

export const publicOfferingDetailSchema = publicOfferingSummarySchema
  .extend({
    content: offeringContentSchema,
    seoTitle: z.string().nullable(),
    seoDescription: z.string().nullable(),
    canonicalUrl: z.string().url().nullable(),
  })
  .strict();

export const adminOfferingInputSchema = z
  .object({
    coverMediaId: z.string().uuid().nullable().optional(),
    type: publicOfferingTypeSchema,
    title: z.string().trim().min(1).max(220),
    slug: offeringSlugSchema.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    summary: z.string().trim().min(1).max(10_000).nullable(),
    content: offeringContentSchema,
    icon: z.string().trim().min(1).max(120).nullable(),
    status: z.enum(["draft", "review", "scheduled", "published", "archived"]),
    scheduledAt: z.coerce.date().nullable(),
    sortOrder: z.number().int().min(0).max(10_000),
    isFeatured: z.boolean(),
    seoTitle: z.string().trim().min(1).max(70).nullable(),
    seoDescription: z.string().trim().min(1).max(180).nullable(),
    canonicalUrl: z.string().url().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "scheduled" && !value.scheduledAt) {
      context.addIssue({ code: "custom", path: ["scheduledAt"], message: "Nội dung hẹn giờ cần có thời điểm xuất bản." });
    }
  });

export const adminOfferingSchema = adminOfferingInputSchema
  .safeExtend({
    id: z.string().uuid(),
    draftVersion: z.number().int().nonnegative(),
    coverMediaId: z.string().uuid().nullable(),
    publishedAt: z.date().nullable(),
    updatedAt: z.date(),
  })
  .strict();

export type OfferingContent = z.infer<typeof offeringContentSchema>;
export type AdminOffering = z.infer<typeof adminOfferingSchema>;
export type AdminOfferingInput = z.infer<typeof adminOfferingInputSchema>;
export type PublicOfferingDetail = z.infer<typeof publicOfferingDetailSchema>;
export type PublicOfferingSummary = z.infer<typeof publicOfferingSummarySchema>;
export type PublicOfferingType = z.infer<typeof publicOfferingTypeSchema>;
