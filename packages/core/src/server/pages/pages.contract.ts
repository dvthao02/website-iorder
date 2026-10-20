import { z } from "zod";
import { richDocumentSchema } from "../shared/rich-text";
import { adminListQuerySchema } from "../shared/admin-list.contract";
import type { CmsModuleKey, CmsPermissionCode } from "../auth/permissions";

export const pageListQuerySchema = adminListQuerySchema.extend({ status: z.enum(["draft", "review", "scheduled", "published", "archived"]).optional() });
export const pageSaveRequestSchema = z.object({ id: z.string().uuid().nullable(), values: z.unknown(), expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() }).strict().superRefine((value, context) => {
  if (value.id && value.expectedVersion === undefined) context.addIssue({ code: "custom", path: ["expectedVersion"], message: "Vui lòng tải lại trang để lấy phiên bản trước khi lưu." });
});

// Route thuộc về code; CMS chỉ quản lý nội dung, SEO và trạng thái của các trang này.
// `kind: "listing"` là trang danh sách của một bộ sưu tập (bài viết, thiết bị…): phần đầu
// trang lấy từ khối "Mở đầu", danh sách do route render. `ownerModule` cho phép người quản lý
// module đó sửa trang danh sách của mình mà không cần quyền "Trang website".
type FixedWebsitePage = {
  slug: string;
  publicPath: string;
  label: string;
  template: string;
  kind: "standard" | "listing";
  ownerModule: CmsModuleKey | null;
};

export const fixedWebsitePages = [
  { slug: "home", publicPath: "/", label: "Trang chủ", template: "homepage", kind: "standard", ownerModule: null },
  { slug: "about", publicPath: "/gioi-thieu", label: "Giới thiệu", template: "default", kind: "standard", ownerModule: null },
  { slug: "contact", publicPath: "/lien-he", label: "Liên hệ", template: "contact", kind: "standard", ownerModule: null },
  { slug: "support-faq", publicPath: "/ho-tro/faq", label: "Câu hỏi thường gặp", template: "default", kind: "standard", ownerModule: null },
  { slug: "support-videos", publicPath: "/ho-tro/video", label: "Video hướng dẫn", template: "default", kind: "standard", ownerModule: null },
  { slug: "remote-support", publicPath: "/ho-tro-tu-xa", label: "Hỗ trợ từ xa", template: "default", kind: "standard", ownerModule: null },
  { slug: "terms", publicPath: "/terms", label: "Điều khoản dịch vụ", template: "default", kind: "standard", ownerModule: null },
  { slug: "privacy-policy", publicPath: "/privacy-policy", label: "Chính sách bảo mật", template: "default", kind: "standard", ownerModule: null },
  { slug: "listing-news", publicPath: "/tin-tuc", label: "Danh sách tin tức", template: "listing", kind: "listing", ownerModule: "posts" },
  { slug: "listing-equipment", publicPath: "/thiet-bi", label: "Danh sách thiết bị", template: "listing", kind: "listing", ownerModule: "equipment" },
  { slug: "listing-support", publicPath: "/ho-tro/cai-dat", label: "Hỗ trợ cài đặt", template: "listing", kind: "listing", ownerModule: "support_downloads" },
  { slug: "listing-software", publicPath: "/phan-mem", label: "Danh sách phần mềm", template: "listing", kind: "listing", ownerModule: "offerings" },
  { slug: "listing-solution", publicPath: "/giai-phap", label: "Danh sách giải pháp", template: "listing", kind: "listing", ownerModule: "offerings" },
  { slug: "listing-service", publicPath: "/dich-vu", label: "Danh sách dịch vụ", template: "listing", kind: "listing", ownerModule: "offerings" },
] as const satisfies ReadonlyArray<FixedWebsitePage>;

export type FixedWebsitePageSlug = (typeof fixedWebsitePages)[number]["slug"];
export type ListingPageSlug = Extract<(typeof fixedWebsitePages)[number], { kind: "listing" }>["slug"];

export function getFixedWebsitePage(slug: string): FixedWebsitePage | undefined {
  return fixedWebsitePages.find(page => page.slug === slug);
}

export function isListingPageSlug(slug: string): slug is ListingPageSlug {
  return getFixedWebsitePage(slug)?.kind === "listing";
}

// Quyền đủ để thao tác một trang: luôn có quyền "Trang website"; trang danh sách
// có thêm quyền cùng hành động của module sở hữu (người dùng cần một trong số đó).
export function pagePermissionCodes(slug: string | null | undefined, action: "view" | "update" | "publish"): CmsPermissionCode[] {
  const owner = slug ? getFixedWebsitePage(slug)?.ownerModule : null;
  return owner ? [`pages.${action}`, `${owner}.${action}` as CmsPermissionCode] : [`pages.${action}`];
}

/** Module có trang danh sách; dùng cho kiểm tra quyền thô ở proxy. */
export const listingPageOwnerModules = [...new Set(fixedWebsitePages.flatMap(page => page.ownerModule ? [page.ownerModule] : []))];

// Nguồn của khối "Danh sách nội dung": cùng một khối hiển thị được ở trang danh sách
// lẫn bất kỳ trang nào (trang chủ, landing page…).
export const collectionSources = [
  { value: "posts", label: "Bài viết & tin tức" },
  { value: "guides", label: "Hướng dẫn cài đặt" },
  { value: "downloads", label: "Tệp cài đặt" },
  { value: "equipment", label: "Thiết bị" },
  { value: "software", label: "Phần mềm" },
  { value: "solution", label: "Giải pháp" },
  { value: "service", label: "Dịch vụ" },
] as const;
export type CollectionSource = (typeof collectionSources)[number]["value"];
const collectionSourceSchema = z.enum(collectionSources.map(source => source.value) as [CollectionSource, ...CollectionSource[]]);
export const collectionListDataSchema = z.object({
  source: collectionSourceSchema,
  eyebrow: z.string().trim().max(160).nullable(),
  title: z.string().trim().max(220).nullable(),
  description: z.string().trim().max(2_000).nullable(),
  limit: z.number().int().min(1).max(100).nullable(),
  anchor: z.string().trim().max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
}).strict();
export type CollectionListData = z.infer<typeof collectionListDataSchema>;

const actionSchema = z.object({ label: z.string().trim().min(1).max(120), href: z.string().trim().min(1).max(1000) }).strict();
const cardSchema = z.object({ title: z.string().trim().min(1).max(220), description: z.string().trim().max(10_000), href: z.string().trim().max(1000).nullable() }).strict();
const cardBlockDataSchema = z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), description: z.string().trim().max(10_000).nullable(), items: z.array(cardSchema).max(30) }).strict();

export const pageBlockInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), description: z.string().trim().max(10_000).nullable(), primaryAction: actionSchema.nullable(), secondaryAction: actionSchema.nullable(), mediaId: z.string().uuid().nullable().optional() }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("stats"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().max(220).nullable(), items: z.array(z.object({ value: z.string().trim().min(1).max(120), label: z.string().trim().min(1).max(220), note: z.string().trim().max(500).nullable() }).strict()).min(1).max(12) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.enum(["features", "industries", "ecosystem", "process"]), data: cardBlockDataSchema, isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("testimonials"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), limit: z.number().int().min(1).max(30) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("partners"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), kind: z.enum(["partner", "customer", "all"]), limit: z.number().int().min(1).max(60) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("featured_posts"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), limit: z.number().int().min(1).max(12) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("faq"), data: z.object({ eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), items: z.array(z.object({ question: z.string().trim().min(1).max(500), answer: z.string().trim().min(1).max(10_000) }).strict()).min(1).max(40) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("cta"), data: z.object({ id: z.string().trim().max(100).nullable(), eyebrow: z.string().trim().max(160).nullable(), title: z.string().trim().min(1).max(220), action: actionSchema }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("lead_form"), data: z.object({ title: z.string().trim().min(1).max(220), description: z.string().trim().max(2_000).nullable(), submitLabel: z.string().trim().min(1).max(120), needOptions: z.array(z.string().trim().min(1).max(200)).max(20) }).strict(), isEnabled: z.boolean() }).strict(),
  // body: chữ thuần (khối cũ) hoặc tài liệu soạn thảo kiểu Word (xem shared/rich-text).
  z.object({ type: z.literal("rich_text"), data: z.object({ heading: z.string().trim().max(220).nullable(), body: z.union([z.string().trim().min(1).max(50_000), richDocumentSchema]) }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("image"), data: z.object({ mediaId: z.string().uuid(), alt: z.string().trim().max(500).nullable(), caption: z.string().trim().max(2_000).nullable() }).strict(), isEnabled: z.boolean() }).strict(),
  z.object({ type: z.literal("collection_list"), data: collectionListDataSchema, isEnabled: z.boolean() }).strict(),
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
// Dữ liệu trang cho website: không có trạng thái, phiên bản, lịch hẹn giờ hay khối đã tắt.
export const publicPageSchema = z.object({
  title: z.string(), slug: z.string(), template: z.string(),
  seoTitle: z.string().nullable(), seoDescription: z.string().nullable(), canonicalUrl: z.string().nullable(),
  blocks: z.array(pageBlockInputSchema),
}).strict();
export type PublicPage = z.infer<typeof publicPageSchema>;
export type PageInput = z.infer<typeof pageInputSchema>;
export type PageBlock = z.infer<typeof pageBlockInputSchema>;

export type ListingHeader = { eyebrow: string | null; title: string; description: string | null };

// Phần đầu trang danh sách = khối "Mở đầu" đầu tiên đang bật của trang.
export function listingHeaderFromBlocks(blocks: readonly PageBlock[]): ListingHeader | undefined {
  const hero = blocks.find((block): block is Extract<PageBlock, { type: "hero" }> => block.type === "hero" && block.isEnabled);
  return hero ? { eyebrow: hero.data.eyebrow, title: hero.data.title, description: hero.data.description } : undefined;
}

// Danh sách mặc định của từng trang danh sách khi trang chưa có khối "Danh sách nội dung".
export const defaultListingCollections: Record<ListingPageSlug, CollectionListData[]> = {
  "listing-news": [{ source: "posts", eyebrow: null, title: null, description: null, limit: null, anchor: null }],
  "listing-equipment": [{ source: "equipment", eyebrow: null, title: null, description: null, limit: null, anchor: null }],
  "listing-support": [
    { source: "downloads", eyebrow: null, title: "Tệp cài đặt", description: null, limit: null, anchor: "tep-cai-dat" },
    { source: "guides", eyebrow: "Trung tâm trợ giúp", title: "Hướng dẫn sử dụng", description: null, limit: null, anchor: "huong-dan" },
  ],
  "listing-software": [{ source: "software", eyebrow: null, title: null, description: null, limit: null, anchor: null }],
  "listing-solution": [{ source: "solution", eyebrow: null, title: null, description: null, limit: null, anchor: null }],
  "listing-service": [{ source: "service", eyebrow: null, title: null, description: null, limit: null, anchor: null }],
};

export type ListingLayout = { header: ListingHeader; blocks: PageBlock[] };

// Trang danh sách = khối "Mở đầu" đầu tiên làm phần đầu trang + các khối còn lại theo thứ tự.
// Nếu không có khối danh sách nào đang bật, thêm danh sách mặc định của trang vào cuối.
// Thiếu khối "Mở đầu" thì dùng `fallbackHeader` (thường là tên trang) nếu có.
export function listingLayoutFromBlocks(slug: ListingPageSlug, blocks: readonly PageBlock[], fallbackHeader?: ListingHeader): ListingLayout | undefined {
  const heroIndex = blocks.findIndex(block => block.type === "hero" && block.isEnabled);
  const header = listingHeaderFromBlocks(blocks) ?? fallbackHeader;
  if (!header) return undefined;
  const rest = blocks.filter((block, index) => index !== heroIndex && block.isEnabled);
  const hasCollection = rest.some(block => block.type === "collection_list");
  return { header, blocks: hasCollection ? rest : [...rest, ...defaultListingCollections[slug].map(data => ({ type: "collection_list" as const, isEnabled: true, data }))] };
}
