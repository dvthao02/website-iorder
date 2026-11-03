import { adminOfferingInputSchema, type AdminOffering, type AdminOfferingInput, type PublicOfferingType } from "../offerings/offering-content.contract";
import { createAdminOffering, getAdminOfferings, updateAdminOffering } from "../offerings/offerings.service";
import { contentStatuses, field, integer, lines, slugCell, statusCell, text, yesNo, type ContentStatus, type TransferDataset } from "./transfer";

type OfferingRow = AdminOffering & { version: number };

const importNote = "Nhập từ file Excel/CSV";
const liveStatuses = new Set<ContentStatus>(["published", "scheduled"]);
const typeInfo: Record<PublicOfferingType, { label: string; fileName: string }> = {
  software: { label: "Sản phẩm", fileName: "san-pham" },
  solution: { label: "Giải pháp", fileName: "giai-phap" },
  service: { label: "Dịch vụ", fileName: "dich-vu" },
};
const optional = <T>(value: T | null | undefined) => value ?? null;
const joinLines = (items: string[]) => items.join("\n");

/**
 * Sản phẩm / Giải pháp / Dịch vụ: mỗi loại một bảng vì slug chỉ duy nhất trong từng loại.
 * File gồm phần chữ chính; hỏi đáp, bảng giá, ảnh bìa, nội dung liên quan và "Thông tin bổ sung" giữ nguyên (sửa trong CMS).
 */
export function offeringTransfer(type: PublicOfferingType): TransferDataset<OfferingRow, null> {
  const { label, fileName } = typeInfo[type];
  return {
    id: `offerings-${type}`,
    label,
    fileName,
    module: "offerings",
    fields: [
      field({ key: "slug", header: "Đường dẫn (slug)", width: 34, get: (item) => item.slug, format: (value) => value, parse: slugCell }),
      field({ key: "name", header: "Tên", width: 34, requiredOnCreate: true, get: (item) => item.title, format: (value) => value, parse: text(220, { required: true }) }),
      field({ key: "summary", header: "Tóm tắt", width: 50, get: (item) => item.summary, format: (value) => value, parse: text(10_000) }),
      field({ key: "description", header: "Mô tả", width: 60, requiredOnCreate: true, get: (item) => item.content.description, format: (value) => value, parse: text(20_000, { required: true }) }),
      field({ key: "features", header: "Tính năng (mỗi dòng một mục)", width: 40, get: (item) => item.content.features, format: (value: string[]) => joinLines(value), parse: lines({ maxItems: 100, maxLength: 500 }) }),
      field({ key: "benefits", header: "Lợi ích (mỗi dòng một mục)", width: 40, get: (item) => item.content.benefits, format: (value: string[]) => joinLines(value), parse: lines({ maxItems: 100, maxLength: 500 }) }),
      field({ key: "status", header: "Trạng thái", width: 14, get: (item) => item.status, format: (value: ContentStatus) => contentStatuses[value], parse: statusCell }),
      field({ key: "isFeatured", header: "Nổi bật", width: 10, get: (item) => item.isFeatured, format: (value: boolean) => value ? "Có" : "Không", parse: yesNo }),
      field({ key: "sortOrder", header: "Thứ tự", width: 10, get: (item) => item.sortOrder, format: (value) => value, parse: integer({ min: 0, max: 10_000 }) }),
      field({ key: "seoTitle", header: "Tiêu đề SEO", width: 34, get: (item) => item.seoTitle, format: (value) => value, parse: text(70) }),
      field({ key: "seoDescription", header: "Mô tả SEO", width: 50, get: (item) => item.seoDescription, format: (value) => value, parse: text(180) }),
    ],
    async load() {
      const items = (await getAdminOfferings()).filter((item) => item.type === type).map((item) => ({ ...item, version: item.draftVersion }));
      return { items, context: null };
    },
    build(changes, existing) {
      const errors: string[] = [];
      const base: AdminOfferingInput = existing
        ? Object.fromEntries(Object.keys(adminOfferingInputSchema.shape).map((key) => [key, Reflect.get(existing, key)])) as AdminOfferingInput
        : { coverMediaId: null, type, title: "", slug: "", summary: null, icon: null, status: "draft", scheduledAt: null, sortOrder: 0, isFeatured: false, seoTitle: null, seoDescription: null, canonicalUrl: null,
          content: { description: "", tags: [], bestFor: null, keyValue: null, metrics: [], features: [], benefits: [], faq: [], items: [], category: null, pricing: null } };
      const input: AdminOfferingInput = { ...base, content: { ...base.content } };
      if (typeof changes.slug === "string" && !existing) input.slug = changes.slug;
      if (typeof changes.name === "string") input.title = changes.name;
      if ("summary" in changes) input.summary = optional(changes.summary as string | null);
      if (typeof changes.description === "string") input.content.description = changes.description;
      if (Array.isArray(changes.features)) input.content.features = changes.features as string[];
      if (Array.isArray(changes.benefits)) input.content.benefits = changes.benefits as string[];
      if (typeof changes.isFeatured === "boolean") input.isFeatured = changes.isFeatured;
      if (typeof changes.sortOrder === "number") input.sortOrder = changes.sortOrder;
      if ("seoTitle" in changes) input.seoTitle = optional(changes.seoTitle as string | null);
      if ("seoDescription" in changes) input.seoDescription = optional(changes.seoDescription as string | null);
      if (typeof changes.status === "string") {
        const status = changes.status as ContentStatus;
        if (status === "scheduled" && !(existing?.status === "scheduled" && existing.scheduledAt)) errors.push(`Đặt hẹn giờ trong màn sửa ${label.toLocaleLowerCase("vi")} (cần chọn thời điểm đăng).`);
        input.status = status;
        if (status !== "scheduled") input.scheduledAt = null;
      }
      return { input, errors, live: { before: Boolean(existing && liveStatuses.has(existing.status)), after: liveStatuses.has(input.status) } };
    },
    schema: adminOfferingInputSchema,
    async write(input, existing, actorId) {
      if (!existing) return (await createAdminOffering(input, actorId)).id;
      const saved = await updateAdminOffering(existing.id, input, actorId, importNote, existing.version);
      if (!saved) throw new Error(`Không tìm thấy ${label.toLocaleLowerCase("vi")} (có thể vừa bị xóa).`);
      return saved.id;
    },
  };
}
