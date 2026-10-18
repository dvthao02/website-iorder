import { z } from "zod";
import { adminListQuerySchema } from "../shared/admin-list.contract";

const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);

export const publicLeadInputSchema = z.object({
  name: z.string().trim().min(2).max(180),
  phone: z.string().trim().min(8).max(30).regex(/^[0-9+(). -]+$/),
  email: z.string().trim().email().max(320).or(z.literal("")).transform((value) => value || null),
  businessModel: optionalText(120),
  branches: optionalText(60),
  need: optionalText(200),
  message: optionalText(5_000),
  website: z.string().max(0).optional(),
}).strict();

export const leadStatusSchema = z.enum(["new", "contacted", "closed"]);
export const leadListQuerySchema = adminListQuerySchema.extend({
  status: z.enum(["all", "new", "contacted", "closed"]).default("all"),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export const leadExportQuerySchema = z.object({ status: leadListQuerySchema.shape.status, query: z.string().trim().max(160).optional() }).strict();
export type LeadExportQuery = z.infer<typeof leadExportQuerySchema>;
const leadListItemSchema = z.object({
  id: z.string().uuid(), name: z.string().max(180), phone: z.string().max(30),
  email: z.string().max(320).nullable(), businessModel: z.string().max(120).nullable(),
  branches: z.string().max(60).nullable(), need: z.string().max(200).nullable(), message: z.string().nullable(),
  status: leadStatusSchema, createdAt: z.date(), handledAt: z.date().nullable(),
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
