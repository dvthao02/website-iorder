import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const webUrl = z.string().url().max(2000).refine(value => /^https?:\/\//i.test(value), "Dùng địa chỉ bắt đầu bằng http:// hoặc https://.");

// Các trường SEO cũ vẫn nằm ở cột riêng. JSONB này chỉ chứa phần mở rộng, độc lập với nội dung.
export const structuredDataDocumentSchema = z.object({
  type: z.enum(["WebPage", "Article", "Service", "Product", "Organization", "FAQPage"]),
  name: text(220).optional(),
  description: text(2000).optional(),
  url: webUrl.optional(),
  imageMediaId: z.string().uuid().nullable().optional(),
  author: text(180).optional(),
  brand: text(180).optional(),
  sku: text(120).optional(),
  price: z.number().nonnegative().max(1e15).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  questions: z.array(z.object({ question: text(500).min(1), answer: text(10000).min(1) }).strict()).max(50).optional(),
}).strict().superRefine((value, context) => {
  if (value.type === "FAQPage" && !value.questions?.length) context.addIssue({ code: "custom", path: ["questions"], message: "Thêm ít nhất một câu hỏi và câu trả lời." });
  if (value.price !== undefined && !value.currency) context.addIssue({ code: "custom", path: ["currency"], message: "Chọn đơn vị tiền tệ cho giá." });
});

const socialSchema = z.object({ title: text(220).optional(), description: text(2000).optional(), imageMediaId: z.string().uuid().nullable().optional() }).strict();
export const contentSeoSchema = z.object({
  index: z.boolean().optional(),
  follow: z.boolean().optional(),
  sitemap: z.boolean().optional(),
  breadcrumbs: z.boolean().optional(),
  openGraph: socialSchema.optional(),
  twitter: socialSchema.extend({ card: z.enum(["summary", "summary_large_image"]).optional() }).optional(),
  // Không có: dùng schema tự động hiện có; []: tắt schema nội dung; có phần tử: schema tùy chỉnh qua form.
  structuredData: z.array(structuredDataDocumentSchema).max(10).optional(),
}).strict();

export type ContentSeo = z.infer<typeof contentSeoSchema>;
export type StructuredDataDocument = z.infer<typeof structuredDataDocumentSchema>;
export function isSitemapEligible(seo?: ContentSeo) { return seo?.index !== false && seo?.sitemap !== false; }

export const contentSeoVisibilitySchema = contentSeoSchema.pick({ index: true, sitemap: true }).strip();
