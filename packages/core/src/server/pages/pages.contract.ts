import { z } from "zod";
import { adminListQuerySchema } from "../shared/admin-list.contract";

export const pageListQuerySchema = adminListQuerySchema.extend({ status: z.enum(["draft", "review", "scheduled", "published", "archived"]).optional() });
export const pageSaveRequestSchema = z.object({ id: z.string().uuid().nullable(), values: z.unknown(), expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() }).strict().superRefine((value, context) => {
  if (value.id && value.expectedVersion === undefined) context.addIssue({ code: "custom", path: ["expectedVersion"], message: "Vui lòng tải lại trang để lấy phiên bản trước khi lưu." });
});

// Route thuộc về code; CMS chỉ quản lý nội dung, SEO và trạng thái của các trang này.
export const fixedWebsitePages = [
  { slug: "home", publicPath: "/", label: "Trang chủ", template: "homepage" },
  { slug: "about", publicPath: "/gioi-thieu", label: "Giới thiệu", template: "default" },
  { slug: "contact", publicPath: "/lien-he", label: "Liên hệ", template: "contact" },
  { slug: "support-faq", publicPath: "/ho-tro/faq", label: "Câu hỏi thường gặp", template: "default" },
  { slug: "support-videos", publicPath: "/ho-tro/video", label: "Video hướng dẫn", template: "default" },
  { slug: "remote-support", publicPath: "/ho-tro-tu-xa", label: "Hỗ trợ từ xa", template: "default" },
  { slug: "terms", publicPath: "/terms", label: "Điều khoản dịch vụ", template: "default" },
  { slug: "privacy-policy", publicPath: "/privacy-policy", label: "Chính sách bảo mật", template: "default" },
] as const;

export function getFixedWebsitePage(slug: string) {
  return fixedWebsitePages.find(page => page.slug === slug);
}

const actionSchema = z.object({ label: z.string().trim().min(1).max(120), href: z.string().trim().min(1).max(1000) }).strict();
const cardSchema = z.object({ title: z.string().trim().min(1).max(220), description: z.string().trim().max(10_000), href: z.string().trim().max(1000).nullable() }).strict();
const cardBlockDataSchema = z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), description: z.string().trim().max(10_000).nullable(), items: z.array(cardSchema).max(30) }).strict();

export const pageBlockInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), description: z.string().trim().max(10_000).nullable(), primaryAction: actionSchema.nullable(), secondaryAction: actionSchema.nullable() }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("stats"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().max(220).nullable(), items: z.array(z.object({ value: z.string().trim().min(1).max(120), label: z.string().trim().min(1).max(220), note: z.string().trim().max(500).nullable() }).strict()).min(1).max(12) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.enum(["features", "industries", "ecosystem", "process"]), data: cardBlockDataSchema, isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("testimonials"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), limit: z.number().int().min(1).max(30) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("partners"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), kind: z.enum(["partner", "customer", "all"]), limit: z.number().int().min(1).max(60) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("featured_posts"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), limit: z.number().int().min(1).max(12) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("faq"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), items: z.array(z.object({ question: z.string().trim().min(1).max(500), answer: z.string().trim().min(1).max(10_000) }).strict()).min(1).max(40) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("cta"), data: z.object({ id: z.string().trim().max(100).nullable(), eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), action: actionSchema }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("lead_form"), data: z.object({ title: z.string().trim().min(1).max(220), description: z.string().trim().max(2_000).nullable(), submitLabel: z.string().trim().min(1).max(120), needOptions: z.array(z.string().trim().min(1).max(200)).max(20) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("rich_text"), data: z.object({ heading: z.string().trim().max(220).nullable(), body: z.string().trim().min(1).max(50_000) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("image"), data: z.object({ mediaId: z.string().uuid(), alt: z.string().trim().max(500).nullable(), caption: z.string().trim().max(2_000).nullable() }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("download_list"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220) }).strict(), isEnabled: z.boolean() }).strict(),
]);

export const pageInputSchema = z.object({
  title: z.string().trim().min(1).max(220), slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), template: z.string().trim().min(1).max(80),
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]), seoTitle: z.string().trim().max(70).nullable(), seoDescription: z.string().trim().max(180).nullable(), canonicalUrl: z.string().url().nullable(), scheduledAt: z.coerce.date().nullable(), blocks: z.array(pageBlockInputSchema).max(100),
}).strict().superRefine((value, ctx) => {
  if (value.status === "scheduled" && !value.scheduledAt) ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Trang hẹn giờ cần thời điểm xuất bản." });
});

export const adminPageSchema = pageInputSchema.safeExtend({ id: z.string().uuid(), draftVersion: z.number().int().nonnegative(), publishedAt: z.date().nullable(), updatedAt: z.date() });
export const adminPagesPageSchema = z.object({
  items: z.array(adminPageSchema), page: z.number().int().positive(), pageSize: z.number().int().min(5).max(100),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), totalPages: z.number().int().positive(),
}).superRefine((value, context) => {
  const expected = Math.max(0, Math.min(value.pageSize, value.total - (value.page - 1) * value.pageSize));
  if (value.totalPages !== Math.max(1, Math.ceil(value.total / value.pageSize)) || value.items.length !== expected || new Set(value.items.map(page => page.id)).size !== value.items.length) {
    context.addIssue({ code: "custom", message: "Phản hồi danh sách trang không nhất quán." });
  }
});
export type AdminPage = z.infer<typeof adminPageSchema>;
export type PageInput = z.infer<typeof pageInputSchema>;
export type PageBlock = z.infer<typeof pageBlockInputSchema>;
