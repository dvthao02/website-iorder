import { z } from "zod";
import { equipmentAvailabilityValues } from "../equipment/equipment-availability";
import { adminListQuerySchema, listDateSchema } from "../shared/admin-list.contract";
import { countLinks, isPlausibleName, isPlausiblePhone, leadMaxLinks } from "./leads.guard";

// Trường tùy chọn: để trống hoặc vắng hẳn đều thành null. Biểu mẫu website chỉ gửi họ tên, số điện thoại, email, nhu cầu và mô tả,
// không gửi businessModel/branches; trước đây hai khóa đó bị bắt buộc nên MỌI liên hệ từ website bị từ chối (HTTP 400).
const optionalText = (maximum: number) => z.string().trim().max(maximum).default("").transform((value) => value || null);

// Mã thiết bị (slug) khách đang hỏi mua; Backend tự tra thiết bị và chụp tình trạng lúc gửi, không tin tên/giá do trình duyệt gửi.
const equipmentSlugField = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const publicLeadInputSchema = z.object({
  name: z.string().trim().min(2).max(180).refine(isPlausibleName, "Họ tên không hợp lệ."),
  phone: z.string().trim().min(8).max(30).regex(/^[0-9+(). -]+$/).refine(isPlausiblePhone, "Số điện thoại không hợp lệ."),
  email: z.string().trim().email().max(320).or(z.literal("")).default("").transform((value) => value || null),
  businessModel: optionalText(120),
  branches: optionalText(60),
  need: optionalText(200),
  message: optionalText(2_000).refine((value) => !value || countLinks(value) <= leadMaxLinks, "Lời nhắn có quá nhiều liên kết."),
  // Ô bẫy: người dùng không thấy nên không điền; có chữ thì là bot (Backend nhận như bình thường nhưng không lưu, xem leads.service.ts).
  website: z.string().max(500).optional(),
  // Mã phiên gửi cấp bởi GET /api/v1/leads (leads.guard.ts).
  token: z.string().max(200).optional(),
  equipmentSlug: equipmentSlugField.optional(),
}).strict();

// Thiết bị khách hỏi mua, chụp tại thời điểm gửi và lưu ở contact_leads.context (JSONB có schema này).
export const leadContextSchema = z.object({
  kind: z.literal("equipment"),
  equipmentId: z.string().uuid(),
  slug: z.string().max(180),
  name: z.string().max(220),
  modelCode: z.string().max(80).nullable(),
  brand: z.string().max(80).nullable(),
  groupName: z.string().max(120).nullable(),
  priceVnd: z.number().int().nonnegative(),
  availability: z.enum(equipmentAvailabilityValues),
  // CMS đọc JSON qua reviveDates (khóa kết thúc bằng "At" thành Date, kể cả khóa lồng nhau như khóa này): nhận cả Date, luôn ra chuỗi ISO.
  capturedAt: z.preprocess((value) => (value instanceof Date ? value.toISOString() : value), z.iso.datetime()),
}).strict();
export type LeadContext = z.infer<typeof leadContextSchema>;
/** Đọc ngữ cảnh đã lưu ở DB (JSONB): giá trị hỏng hoặc từ phiên bản cũ thành null thay vì làm hỏng cả danh sách. */
export function parseLeadContext(value: unknown): LeadContext | null {
  const parsed = leadContextSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const leadStatusSchema = z.enum(["new", "contacted", "closed"]);
export const leadListQuerySchema = adminListQuerySchema.extend({
  status: z.enum(["all", "new", "contacted", "closed"]).default("all"),
  from: listDateSchema,
  to: listDateSchema,
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export const leadExportQuerySchema = z.object({ status: leadListQuerySchema.shape.status, query: z.string().trim().max(160).optional(), from: listDateSchema, to: listDateSchema, sort: adminListQuerySchema.shape.sort, dir: adminListQuerySchema.shape.dir, format: z.enum(["csv", "xlsx"]).default("csv") }).strict();
export type LeadExportQuery = z.infer<typeof leadExportQuerySchema>;
const leadListItemSchema = z.object({
  id: z.string().uuid(), name: z.string().max(180), phone: z.string().max(30),
  email: z.string().max(320).nullable(), businessModel: z.string().max(120).nullable(),
  branches: z.string().max(60).nullable(), need: z.string().max(200).nullable(), message: z.string().nullable(),
  status: leadStatusSchema, createdAt: z.date(), handledAt: z.date().nullable(),
  context: leadContextSchema.nullable(),
});
const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const leadListPageSchema = z.object({
  items: z.array(leadListItemSchema), page: z.number().int().positive(),
  pageSize: z.number().int().min(5).max(100), total: countSchema, totalPages: z.number().int().positive(),
  counts: z.object({ all: countSchema, new: countSchema, contacted: countSchema, closed: countSchema }),
}).superRefine((value, ctx) => {
  if (value.counts.all !== value.counts.new + value.counts.contacted + value.counts.closed || value.total > value.counts.all || value.totalPages !== Math.max(1, Math.ceil(value.total / value.pageSize))) {
    ctx.addIssue({ code: "custom", message: "Tổng số liên hệ không nhất quán." });
  }
  const expected = Math.max(0, Math.min(value.pageSize, value.total - (value.page - 1) * value.pageSize));
  if (value.items.length !== expected || new Set(value.items.map(row => row.id)).size !== value.items.length) ctx.addIssue({ code: "custom", message: "Danh sách liên hệ không khớp phân trang." });
});
export const leadStatusUpdateSchema = z.object({ status: leadStatusSchema }).strict();
export const leadStatusUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  status: leadStatusSchema,
  handledAt: z.iso.datetime().nullable(),
}).refine(lead => lead.status === "new" ? lead.handledAt === null : lead.handledAt !== null, {
  message: "Thời điểm xử lý liên hệ không khớp trạng thái.",
});

export type PublicLeadInput = z.infer<typeof publicLeadInputSchema>;
export type LeadStatus = z.infer<typeof leadStatusSchema>;
