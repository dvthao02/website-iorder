import { adminPostInputSchema, type AdminPost, type AdminPostInput, type PublicPostType } from "../posts/posts.contract";
import { createAdminPost, getAdminPosts, updateAdminPost } from "../posts/posts.service";
import { plainTextToRichDocument } from "../shared/rich-text";
import { categoryInputSchema, tagInputSchema } from "../taxonomy/taxonomy.contract";
import { getTaxonomy, writeTaxonomy } from "../taxonomy/taxonomy.service";
import { contentStatuses, field, integer, lines, slugCell, statusCell, text, type ContentStatus, type Parsed, type TransferDataset } from "./transfer";

type PostRow = AdminPost & { version: number };
type Taxonomy = Awaited<ReturnType<typeof getTaxonomy>>;
type CategoryRow = Taxonomy["categories"][number];
type TagRow = Taxonomy["tags"][number];
type Term = { id: string; name: string; slug: string };

const importNote = "Nhập từ file Excel/CSV";
const liveStatuses = new Set<ContentStatus>(["published", "scheduled"]);
const normalize = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
const optional = <T>(value: T | null | undefined) => value ?? null;
export const newsPostTypes = { news: "Tin tức", promotion: "Khuyến mãi", case_study: "Câu chuyện khách hàng", announcement: "Thông báo" } as const;
type NewsPostType = keyof typeof newsPostTypes;

/** Tra chuyên mục/thẻ theo slug hoặc tên; null = trùng tên (mơ hồ). Nạp trong load() của từng request. */
function termIndex<T extends Term>() {
  const byKey = new Map<string, T | null>();
  const byId = new Map<string, T>();
  return {
    fill(terms: T[]) {
      for (const term of terms) {
        byId.set(term.id, term);
        byKey.set(normalize(term.slug), term);
        const key = normalize(term.name);
        byKey.set(key, byKey.has(key) && byKey.get(key)?.id !== term.id ? null : term);
      }
    },
    resolve: (value: string) => byKey.get(normalize(value)),
    name: (value: string) => byKey.get(normalize(value))?.name ?? value,
    nameOfId: (id: string) => byId.get(id)?.name ?? id,
  };
}

/** Danh sách tên đã chuẩn hóa và sắp xếp, để đổi thứ tự hay ghi slug thay tên không bị tính là thay đổi. */
const termList = (index: { name: (value: string) => string }) => (value: string[]) => [...new Set(value.map(index.name))].sort((a, b) => a.localeCompare(b, "vi")).join("\n");

function resolveTerms<T extends Term>(names: string[], index: { resolve: (value: string) => T | null | undefined }, noun: string, errors: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const term = index.resolve(name);
    if (term === null) errors.push(`Có nhiều ${noun} tên "${name}"; hãy ghi đường dẫn (slug).`);
    else if (!term) errors.push(`${noun[0].toLocaleUpperCase("vi")}${noun.slice(1)} "${name}" chưa có. Tạo ở màn Chuyên mục & Thẻ (hoặc nhập file ${noun}) trước.`);
    else if (!ids.includes(term.id)) ids.push(term.id);
  }
  return ids;
}

const newsTypeCell = (raw: string): Parsed<NewsPostType> => {
  if (!raw) return { ok: true, value: undefined };
  const value = normalize(raw);
  const match = (Object.entries(newsPostTypes) as [NewsPostType, string][]).find(([code, label]) => value === code || value === normalize(label));
  return match ? { ok: true, value: match[0] } : { ok: false, error: `"${raw}" — dùng một trong: ${Object.values(newsPostTypes).join(", ")}.` };
};

/**
 * Bài viết (4 loại tin) hoặc Hướng dẫn. Phần thân bài không nằm trong bảng (soạn trong CMS hoặc nhập/xuất Word);
 * ảnh bìa, ngày khuyến mãi, hẹn giờ giữ nguyên. Bài mới tạo từ bảng lấy tóm tắt làm đoạn mở đầu của thân bài.
 */
export function postTransfer(kind: "posts" | "guides"): TransferDataset<PostRow, null> {
  const categories = termIndex<CategoryRow>();
  const tags = termIndex<TagRow>();
  const guides = kind === "guides";
  return {
    id: kind,
    label: guides ? "Hướng dẫn" : "Bài viết",
    fileName: guides ? "huong-dan" : "bai-viet",
    module: "posts",
    fields: [
      field({ key: "slug", header: "Đường dẫn (slug)", width: 34, get: (item) => item.slug, format: (value) => value, parse: slugCell }),
      field({ key: "name", header: "Tiêu đề", width: 44, requiredOnCreate: true, get: (item) => item.title, format: (value) => value, parse: text(220, { required: true }) }),
      ...(guides ? [] : [field({ key: "type", header: "Loại", width: 20, requiredOnCreate: true, get: (item: PostRow) => item.type as NewsPostType, format: (value: NewsPostType) => newsPostTypes[value] ?? value, parse: newsTypeCell })]),
      // Bài mới từ bảng cần tóm tắt: dùng làm đoạn mở đầu của thân bài nháp (thân bài không được trống). Bài đầy đủ: nhập từ Word.
      field({ key: "excerpt", header: "Tóm tắt", width: 50, requiredOnCreate: true, get: (item) => item.excerpt, format: (value) => value, parse: text(10_000) }),
      field({ key: "categories", header: "Chuyên mục (mỗi dòng một mục)", width: 28, get: (item) => item.categoryIds.map(categories.nameOfId), format: termList(categories), parse: lines({ maxItems: 30, maxLength: 160 }) }),
      field({ key: "tags", header: "Thẻ (mỗi dòng một mục)", width: 28, get: (item) => item.tagIds.map(tags.nameOfId), format: termList(tags), parse: lines({ maxItems: 50, maxLength: 140 }) }),
      field({ key: "badgeText", header: "Nhãn", width: 16, get: (item) => item.badgeText, format: (value) => value, parse: text(60) }),
      field({ key: "ctaLabel", header: "Nút kêu gọi - chữ", width: 22, get: (item) => item.ctaLabel, format: (value) => value, parse: text(80) }),
      field({ key: "ctaUrl", header: "Nút kêu gọi - liên kết", width: 34, get: (item) => item.ctaUrl, format: (value) => value, parse: text(2_000) }),
      field({ key: "status", header: "Trạng thái", width: 14, get: (item) => item.status, format: (value: ContentStatus) => contentStatuses[value], parse: statusCell }),
      field({ key: "seoTitle", header: "Tiêu đề SEO", width: 34, get: (item) => item.seoTitle, format: (value) => value, parse: text(70) }),
      field({ key: "seoDescription", header: "Mô tả SEO", width: 50, get: (item) => item.seoDescription, format: (value) => value, parse: text(180) }),
    ],
    async load() {
      const [posts, taxonomy] = await Promise.all([getAdminPosts(), getTaxonomy()]);
      categories.fill(taxonomy.categories);
      tags.fill(taxonomy.tags);
      const items = posts.filter((post) => (post.type === "guide") === guides).map((post) => ({ ...post, version: post.draftVersion }));
      return { items, context: null };
    },
    build(changes, existing) {
      const errors: string[] = [];
      const base: AdminPostInput = existing
        ? Object.fromEntries(Object.keys(adminPostInputSchema.shape).map((key) => [key, Reflect.get(existing, key)])) as AdminPostInput
        : { coverMediaId: null, type: guides ? "guide" : "news", title: "", slug: "", excerpt: null, content: { version: 2, doc: { type: "doc", content: [] } }, status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null,
          promotionStartAt: null, promotionEndAt: null, ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null, categoryIds: [], tagIds: [] };
      const input: AdminPostInput = { ...base };
      if (typeof changes.slug === "string" && !existing) input.slug = changes.slug;
      if (typeof changes.name === "string") input.title = changes.name;
      if (typeof changes.type === "string") input.type = changes.type as PublicPostType;
      if ("excerpt" in changes) input.excerpt = optional(changes.excerpt as string | null);
      if (!existing && input.excerpt) input.content = { version: 2, doc: plainTextToRichDocument(input.excerpt) };
      if (Array.isArray(changes.categories)) input.categoryIds = resolveTerms(changes.categories as string[], categories, "chuyên mục", errors);
      if (Array.isArray(changes.tags)) input.tagIds = resolveTerms(changes.tags as string[], tags, "thẻ", errors);
      if ("badgeText" in changes) input.badgeText = optional(changes.badgeText as string | null);
      if ("ctaLabel" in changes) input.ctaLabel = optional(changes.ctaLabel as string | null);
      if ("ctaUrl" in changes) input.ctaUrl = optional(changes.ctaUrl as string | null);
      if ("seoTitle" in changes) input.seoTitle = optional(changes.seoTitle as string | null);
      if ("seoDescription" in changes) input.seoDescription = optional(changes.seoDescription as string | null);
      if (typeof changes.status === "string") {
        const status = changes.status as ContentStatus;
        if (status === "scheduled" && !(existing?.status === "scheduled" && existing.scheduledAt)) errors.push("Đặt hẹn giờ trong màn sửa bài (cần chọn thời điểm đăng).");
        input.status = status;
        if (status !== "scheduled") input.scheduledAt = null;
      }
      return { input, errors, live: { before: Boolean(existing && liveStatuses.has(existing.status)), after: liveStatuses.has(input.status) } };
    },
    schema: adminPostInputSchema,
    async write(input, existing, actorId) {
      if (!existing) return (await createAdminPost(input, actorId)).id;
      const saved = await updateAdminPost(existing.id, input, actorId, importNote, existing.version);
      if (!saved) throw new Error("Không tìm thấy bài viết (có thể vừa bị xóa).");
      return saved.id;
    },
  };
}

/** Chuyên mục: cột "Chuyên mục cha" nhận tên hoặc slug của chuyên mục đã có (chuyên mục cha phải có trước). */
export function categoryTransfer(): TransferDataset<CategoryRow, null> {
  const parents = termIndex<CategoryRow>();
  return {
    id: "categories",
    label: "Chuyên mục",
    fileName: "chuyen-muc",
    module: "taxonomy",
    fields: [
      field({ key: "slug", header: "Đường dẫn (slug)", width: 28, get: (item) => item.slug, format: (value) => value, parse: slugCell }),
      field({ key: "name", header: "Tên chuyên mục", width: 28, requiredOnCreate: true, get: (item) => item.name, format: (value) => value, parse: text(160, { required: true }) }),
      field({ key: "parent", header: "Chuyên mục cha", width: 24, get: (item) => item.parentId ? parents.nameOfId(item.parentId) : null, format: (value: string | null) => value ? parents.name(value) : null, parse: text(160) }),
      field({ key: "description", header: "Mô tả", width: 50, get: (item) => item.description, format: (value) => value, parse: text(10_000) }),
      field({ key: "sortOrder", header: "Thứ tự", width: 10, get: (item) => item.sortOrder, format: (value) => value, parse: integer({ min: 0, max: 1_000_000 }) }),
    ],
    async load() {
      const { categories } = await getTaxonomy();
      parents.fill(categories);
      return { items: categories, context: null };
    },
    build(changes, existing) {
      const errors: string[] = [];
      const input = existing
        ? { parentId: existing.parentId, name: existing.name, slug: existing.slug, description: existing.description, sortOrder: existing.sortOrder }
        : { parentId: null as string | null, name: "", slug: "", description: null as string | null, sortOrder: 0 };
      if (typeof changes.slug === "string" && !existing) input.slug = changes.slug;
      if (typeof changes.name === "string") input.name = changes.name;
      if ("description" in changes) input.description = optional(changes.description as string | null);
      if (typeof changes.sortOrder === "number") input.sortOrder = changes.sortOrder;
      if ("parent" in changes) {
        const value = changes.parent as string | null;
        if (!value) input.parentId = null;
        else {
          const [parentId] = resolveTerms([value], parents, "chuyên mục", errors);
          if (parentId && parentId === existing?.id) errors.push("Chuyên mục không thể là cha của chính nó.");
          else if (parentId) input.parentId = parentId;
        }
      }
      return { input, errors, live: { before: false, after: false } };
    },
    schema: categoryInputSchema,
    async write(input, existing, actorId) {
      const saved = await writeTaxonomy("categories", existing?.id ?? null, input, actorId, existing?.version);
      if (!saved) throw new Error("Không tìm thấy chuyên mục (có thể vừa bị xóa).");
      return saved;
    },
  };
}

export function tagTransfer(): TransferDataset<TagRow, null> {
  return {
    id: "tags",
    label: "Thẻ",
    fileName: "the",
    module: "taxonomy",
    fields: [
      field({ key: "slug", header: "Đường dẫn (slug)", width: 28, get: (item) => item.slug, format: (value) => value, parse: slugCell }),
      field({ key: "name", header: "Tên thẻ", width: 28, requiredOnCreate: true, get: (item) => item.name, format: (value) => value, parse: text(120, { required: true }) }),
    ],
    async load() {
      return { items: (await getTaxonomy()).tags, context: null };
    },
    build(changes, existing) {
      const input = { name: typeof changes.name === "string" ? changes.name : existing?.name ?? "", slug: existing?.slug ?? (typeof changes.slug === "string" ? changes.slug : "") };
      return { input, errors: [], live: { before: false, after: false } };
    },
    schema: tagInputSchema,
    async write(input, existing, actorId) {
      const saved = await writeTaxonomy("tags", existing?.id ?? null, input, actorId, existing?.version);
      if (!saved) throw new Error("Không tìm thấy thẻ (có thể vừa bị xóa).");
      return saved;
    },
  };
}
