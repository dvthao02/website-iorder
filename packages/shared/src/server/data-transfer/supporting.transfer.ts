import { partnerInputSchema, testimonialInputSchema, type PartnerInput, type TestimonialInput } from "../supporting/supporting.contract";
import { getAdminPartners, getAdminTestimonials, writeSupporting } from "../supporting/supporting.service";
import { hasDatabaseErrorCode } from "../shared/database-error";
import { field, integer, text, yesNo, type Parsed, type TransferDataset } from "./transfer";

// Đối tác và đánh giá không có slug: khớp dòng theo tên (không phân biệt hoa thường/khoảng trắng).
// Đổi tên trong file sẽ thành mục mới, nên đổi tên làm trong màn sửa. Logo/ảnh đại diện không nằm trong file (giữ nguyên).
type PartnerRow = Awaited<ReturnType<typeof getAdminPartners>>[number] & { slug: string };
type TestimonialRow = Awaited<ReturnType<typeof getAdminTestimonials>>[number] & { slug: string };

const matchKey = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
const optional = <T>(value: T | null | undefined) => value ?? null;
const partnerKinds = { partner: "Đối tác", customer: "Khách hàng" } as const;

const partnerKindCell = (raw: string): Parsed<PartnerInput["kind"]> => {
  const value = matchKey(raw);
  if (!value) return { ok: true, value: undefined };
  const match = (Object.entries(partnerKinds) as [PartnerInput["kind"], string][]).find(([code, label]) => value === code || value === matchKey(label));
  return match ? { ok: true, value: match[0] } : { ok: false, error: `"${raw}" — ghi "Đối tác" hoặc "Khách hàng".` };
};

const websiteCell = (raw: string): Parsed<string | null> => {
  if (!raw) return { ok: true, value: null };
  if (raw.length > 2_000) return { ok: false, error: "dài quá 2000 ký tự." };
  return /^https?:\/\/[^\s]+$/i.test(raw) ? { ok: true, value: raw } : { ok: false, error: `"${raw.slice(0, 60)}" phải là địa chỉ bắt đầu bằng http:// hoặc https://.` };
};

/** Tên có trên 2 mục (đánh giá không bắt buộc tên duy nhất): không biết sửa mục nào, yêu cầu sửa trong CMS. */
function duplicatedKeys(names: string[]) {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const name of names) { const key = matchKey(name); if (seen.has(key)) duplicated.add(key); seen.add(key); }
  return duplicated;
}

function writeError(error: unknown, duplicate: string) {
  return hasDatabaseErrorCode(error, "23505") ? new Error(duplicate) : error;
}

export function partnerTransfer(): TransferDataset<PartnerRow, { duplicated: Set<string> }> {
  return {
    id: "partners",
    label: "Đối tác & khách hàng",
    fileName: "doi-tac",
    module: "supporting",
    matchKey,
    fields: [
      field({ key: "name", header: "Tên", width: 32, requiredOnCreate: true, get: (item) => item.name, format: (value) => value, parse: text(180, { required: true }) }),
      field({ key: "kind", header: "Loại", width: 14, get: (item) => item.kind, format: (value: PartnerInput["kind"]) => partnerKinds[value], parse: partnerKindCell }),
      field({ key: "description", header: "Mô tả", width: 50, get: (item) => item.description, format: (value) => value, parse: text(10_000) }),
      field({ key: "websiteUrl", header: "Website", width: 34, get: (item) => item.websiteUrl, format: (value) => value, parse: websiteCell }),
      field({ key: "sortOrder", header: "Thứ tự", width: 10, get: (item) => item.sortOrder, format: (value) => value, parse: integer({ min: 0, max: 10_000 }) }),
      field({ key: "isEnabled", header: "Hiển thị trên website", width: 20, get: (item) => item.isEnabled, format: (value: boolean) => value ? "Có" : "Không", parse: yesNo }),
    ],
    async load() {
      const items = (await getAdminPartners()).map((item) => ({ ...item, slug: item.name }));
      return { items, context: { duplicated: duplicatedKeys(items.map((item) => item.name)) } };
    },
    build(changes, existing, context) {
      const errors = existing && context.duplicated.has(matchKey(existing.name)) ? [`Có nhiều mục tên "${existing.name}"; hãy sửa trong màn Đối tác & Đánh giá.`] : [];
      const input: PartnerInput = existing
        ? { logoMediaId: existing.logoMediaId, kind: existing.kind, name: existing.name, description: existing.description, websiteUrl: existing.websiteUrl, sortOrder: existing.sortOrder, isEnabled: existing.isEnabled }
        : { logoMediaId: null, kind: "partner", name: String(changes.name ?? ""), description: null, websiteUrl: null, sortOrder: 0, isEnabled: false };
      if (typeof changes.kind === "string") input.kind = changes.kind as PartnerInput["kind"];
      if ("description" in changes) input.description = optional(changes.description as string | null);
      if ("websiteUrl" in changes) input.websiteUrl = optional(changes.websiteUrl as string | null);
      if (typeof changes.sortOrder === "number") input.sortOrder = changes.sortOrder;
      if (typeof changes.isEnabled === "boolean") input.isEnabled = changes.isEnabled;
      return { input, errors, live: { before: Boolean(existing?.isEnabled), after: input.isEnabled } };
    },
    schema: partnerInputSchema,
    async write(input, existing, actorId) {
      try {
        const id = await writeSupporting("partners", existing?.id ?? null, input, actorId, { expectedVersion: existing?.version });
        if (!id) throw new Error("Không tìm thấy đối tác (có thể vừa bị xóa).");
        return id;
      } catch (error) {
        throw writeError(error, "Tên đối tác đã tồn tại.");
      }
    },
  };
}

export function testimonialTransfer(): TransferDataset<TestimonialRow, { duplicated: Set<string> }> {
  return {
    id: "testimonials",
    label: "Đánh giá",
    fileName: "danh-gia",
    module: "supporting",
    matchKey,
    fields: [
      field({ key: "authorName", header: "Người đánh giá", width: 26, requiredOnCreate: true, get: (item) => item.authorName, format: (value) => value, parse: text(180, { required: true }) }),
      field({ key: "authorRole", header: "Chức vụ", width: 20, get: (item) => item.authorRole, format: (value) => value, parse: text(180) }),
      field({ key: "company", header: "Công ty", width: 26, get: (item) => item.company, format: (value) => value, parse: text(180) }),
      field({ key: "quote", header: "Nội dung đánh giá", width: 60, requiredOnCreate: true, get: (item) => item.quote, format: (value) => value, parse: text(10_000, { required: true }) }),
      field({ key: "rating", header: "Số sao (1-5)", width: 12, get: (item) => item.rating, format: (value) => value, parse: integer({ min: 1, max: 5, unit: "sao" }) }),
      field({ key: "sortOrder", header: "Thứ tự", width: 10, get: (item) => item.sortOrder, format: (value) => value, parse: integer({ min: 0, max: 10_000 }) }),
      field({ key: "isEnabled", header: "Hiển thị trên website", width: 20, get: (item) => item.isEnabled, format: (value: boolean) => value ? "Có" : "Không", parse: yesNo }),
    ],
    async load() {
      const items = (await getAdminTestimonials()).map((item) => ({ ...item, slug: item.authorName }));
      return { items, context: { duplicated: duplicatedKeys(items.map((item) => item.authorName)) } };
    },
    build(changes, existing, context) {
      const errors = existing && context.duplicated.has(matchKey(existing.authorName)) ? [`Có nhiều đánh giá của "${existing.authorName}"; hãy sửa trong màn Đối tác & Đánh giá.`] : [];
      const input: TestimonialInput = existing
        ? { avatarMediaId: existing.avatarMediaId, authorName: existing.authorName, authorRole: existing.authorRole, company: existing.company, quote: existing.quote, rating: existing.rating, sortOrder: existing.sortOrder, isEnabled: existing.isEnabled }
        : { avatarMediaId: null, authorName: String(changes.authorName ?? ""), authorRole: null, company: null, quote: "", rating: null, sortOrder: 0, isEnabled: false };
      if ("authorRole" in changes) input.authorRole = optional(changes.authorRole as string | null);
      if ("company" in changes) input.company = optional(changes.company as string | null);
      if (typeof changes.quote === "string") input.quote = changes.quote;
      if (typeof changes.rating === "number") input.rating = changes.rating;
      if (typeof changes.sortOrder === "number") input.sortOrder = changes.sortOrder;
      if (typeof changes.isEnabled === "boolean") input.isEnabled = changes.isEnabled;
      return { input, errors, live: { before: Boolean(existing?.isEnabled), after: input.isEnabled } };
    },
    schema: testimonialInputSchema,
    async write(input, existing, actorId) {
      const id = await writeSupporting("testimonials", existing?.id ?? null, input, actorId, { expectedVersion: existing?.version });
      if (!id) throw new Error("Không tìm thấy đánh giá (có thể vừa bị xóa).");
      return id;
    },
  };
}
