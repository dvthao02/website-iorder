import { z } from "zod";

export const publicPostTypeSchema = z.enum([
  "news",
  "promotion",
  "case_study",
  "announcement",
  "guide",
]);
export type PublicPostType = z.infer<typeof publicPostTypeSchema>;
const publicTaxonomyTermSchema = z.object({ id: z.string().uuid(), name: z.string(), slug: z.string() }).strict();

export const postContentDocumentSchema = z
  .object({
    version: z.literal(1),
    blocks: z
      .array(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("paragraph"), text: z.string().trim().min(1).max(10_000) }).strict(),
          z
            .object({
              type: z.literal("checklist"),
              heading: z.string().trim().min(1).max(180),
              items: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(250),
  })
  .strict();

export const publicPostSummarySchema = z
  .object({
    id: z.string().uuid(),
    type: publicPostTypeSchema,
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().nullable(),
    publishedAt: z.date().nullable(),
    createdAt: z.date(),
    cover: z.object({ url: z.string().startsWith("/media/"), altText: z.string().nullable() }).nullable(),
    categories: z.array(publicTaxonomyTermSchema).default([]),
    tags: z.array(publicTaxonomyTermSchema).default([]),
  })
  .strict();

export const publicPostDetailSchema = publicPostSummarySchema.extend({
  content: postContentDocumentSchema,
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  canonicalUrl: z.string().url().nullable(),
});

export const adminPostInputSchema = z
  .object({
    coverMediaId: z.string().uuid().nullable().optional(),
    type: publicPostTypeSchema,
    title: z.string().trim().min(1).max(220),
    slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    excerpt: z.string().trim().min(1).max(10_000).nullable(),
    content: postContentDocumentSchema,
    status: z.enum(["draft", "review", "scheduled", "published", "archived"]),
    seoTitle: z.string().trim().min(1).max(70).nullable(),
    seoDescription: z.string().trim().min(1).max(180).nullable(),
    canonicalUrl: z.string().url().nullable(),
    promotionStartAt: z.coerce.date().nullable(),
    promotionEndAt: z.coerce.date().nullable(),
    ctaLabel: z.string().trim().min(1).max(80).nullable(),
    ctaUrl: z.string().url().nullable(),
    badgeText: z.string().trim().min(1).max(60).nullable(),
    scheduledAt: z.coerce.date().nullable(),
    categoryIds: z.array(z.string().uuid()).max(30).default([]),
    tagIds: z.array(z.string().uuid()).max(50).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "scheduled" && !value.scheduledAt) {
      context.addIssue({ code: "custom", path: ["scheduledAt"], message: "Bài viết hẹn giờ cần có thời điểm xuất bản." });
    }
  });

export const adminPostSchema = adminPostInputSchema.safeExtend({
  id: z.string().uuid(),
  authorId: z.string().uuid().nullable(),
  coverMediaId: z.string().uuid().nullable(),
  draftVersion: z.number().int().nonnegative(),
  publishedAt: z.date().nullable(),
  updatedAt: z.date(),
});

export type PublicPostSummary = z.infer<typeof publicPostSummarySchema>;
export type PostContentDocument = z.infer<typeof postContentDocumentSchema>;
export type PublicPostDetail = z.infer<typeof publicPostDetailSchema>;
export type AdminPost = z.infer<typeof adminPostSchema>;
export type AdminPostInput = z.infer<typeof adminPostInputSchema>;
