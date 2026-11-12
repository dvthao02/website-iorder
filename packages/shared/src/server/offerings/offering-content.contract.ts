import { contentSeoSchema, contentSeoVisibilitySchema } from "../shared/content-seo";
import { z } from "zod";
import { blockAppearanceSchema, detailHeroLayoutSchema, type DetailHeroLayout } from "../shared/appearance";
import { pricingDataSchema } from "../shared/pricing.contract";
import { pageBlockInputSchema } from "../pages/pages.contract";

const shortTextSchema = z.string().trim().min(1).max(500);

// Giao diện từng phần của trang chi tiết (nền, màu tự chọn, ảnh nền, độ rộng, khoảng cách) — cùng vỏ chung với khối trang.
// Thiếu phần nào thì phần đó "Tự động" (nền trắng / xanh nhạt xen kẽ).
export const offeringSectionKeys = ["overview", "benefits", "pricing", "related"] as const;
export type OfferingSectionKey = typeof offeringSectionKeys[number];
// Bố cục phần đầu trang chi tiết: dùng chung với thiết bị (shared/appearance.ts).
export const offeringHeroLayoutSchema = detailHeroLayoutSchema;
export type OfferingHeroLayout = DetailHeroLayout;
export const offeringSectionAppearanceSchema = z.object({
  hero: offeringHeroLayoutSchema.optional(),
  overview: blockAppearanceSchema.optional(),
  benefits: blockAppearanceSchema.optional(),
  pricing: blockAppearanceSchema.optional(),
  related: blockAppearanceSchema.optional(),
}).strict();

export const publicOfferingTypeSchema = z.enum(["software", "solution", "service"]);
export const offeringSlugSchema = z.string().trim().min(1).max(180);

export const offeringContentSchema = z
  .object({
    description: z.string().trim().max(20_000),
    tags: z.array(shortTextSchema).max(50),
    bestFor: z.string().trim().min(1).max(500).nullable(),
    keyValue: z.string().trim().min(1).max(500).nullable(),
    metrics: z.array(shortTextSchema).max(50),
    features: z.array(shortTextSchema).max(100),
    benefits: z.array(shortTextSchema).max(100),
    faq: z.array(z.tuple([shortTextSchema, shortTextSchema])).max(50),
    items: z.array(z.union([shortTextSchema, z.object({ title: shortTextSchema, href: z.string().regex(/^(\/(?!\/)|https?:\/\/)/) }).strict()])).max(100),
    category: z.string().trim().min(1).max(180).nullable(),
    // Bảng giá trên trang chi tiết (thường chỉ phần mềm có); dữ liệu cũ không có trường này → null.
    pricing: pricingDataSchema.nullable().default(null),
    appearance: offeringSectionAppearanceSchema.default({}),
    // Thành phần trang chi tiết theo cùng schema/trình render với trang chủ; optional để đọc nguyên dữ liệu cũ.
    blocks: z.array(pageBlockInputSchema).max(100).optional(),
  })
  .strict()
  .superRefine((content, context) => {
    if (!content.description && !content.blocks?.length) {
      context.addIssue({ code: "custom", path: ["description"], message: "Thêm mô tả hoặc ít nhất một thành phần nội dung." });
    }
  });

// Trường chung của bản tóm tắt và bản chi tiết.
const publicOfferingBaseSchema = z
  .object({
    id: z.string().uuid(),
    type: publicOfferingTypeSchema,
    title: z.string(),
    slug: z.string(),
    seo: contentSeoVisibilitySchema.optional(),
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

// Thẻ danh sách (/phan-mem, /giai-phap, /dich-vu, khối Danh sách nội dung) còn hiện chuyên mục và số liệu nổi bật,
// lấy từ nội dung chi tiết (CMS › Sản phẩm) nên không cần nhập lại.
export const offeringCardFieldsSchema = z.object({ category: offeringContentSchema.shape.category, metrics: offeringContentSchema.shape.metrics }).partial();
export const publicOfferingSummarySchema = publicOfferingBaseSchema
  .extend({
    category: z.string().nullable(),
    metrics: z.array(z.string()),
  })
  .strict();

export const publicOfferingDetailSchema = publicOfferingBaseSchema
  .extend({
    content: offeringContentSchema,
    seoTitle: z.string().nullable(),
    seoDescription: z.string().nullable(),
    canonicalUrl: z.string().url().nullable(),
    seo: contentSeoSchema.optional(),
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
    seo: contentSeoSchema.optional(),
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
export const adminOfferingListItemSchema = z.object({
  id: z.string().uuid(), type: publicOfferingTypeSchema, title: z.string().min(1).max(220), slug: offeringSlugSchema,
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]),
  draftVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), updatedAt: z.date(),
  // Ảnh bìa để hiện ô thu nhỏ trong bảng (như Shopify/Payload); null khi chưa có ảnh.
  coverUrl: z.string().nullable(),
}).strict();
export type AdminOfferingListItem = z.infer<typeof adminOfferingListItemSchema>;
export type AdminOfferingInput = z.infer<typeof adminOfferingInputSchema>;
export type PublicOfferingDetail = z.infer<typeof publicOfferingDetailSchema>;
export type PublicOfferingSummary = z.infer<typeof publicOfferingSummarySchema>;
export type PublicOfferingType = z.infer<typeof publicOfferingTypeSchema>;
