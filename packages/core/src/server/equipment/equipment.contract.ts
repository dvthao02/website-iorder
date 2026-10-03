import { z } from "zod";

const slug = z.string().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const equipmentGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(180), slug,
  description: z.string().max(10000).nullable(), coverMediaId: z.string().uuid().nullable(),
  sortOrder: z.number().int().min(0).max(10000), isEnabled: z.boolean(),
}).strict();
export const equipmentInputSchema = z.object({
  groupId: z.string().uuid(), name: z.string().trim().min(1).max(220), slug,
  modelCode: z.string().max(80).nullable(), coverMediaId: z.string().uuid().nullable(),
  priceVnd: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  warrantyMonths: z.number().int().min(0).max(1200), summary: z.string().max(20000).nullable(),
  specificationGroups: z.array(z.object({ title: z.string().min(1).max(180), items: z.array(z.object({ label: z.string().min(1).max(180), value: z.string().min(1).max(2000) }).strict()).max(100) }).strict()).max(50),
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]),
  scheduledAt: z.coerce.date().nullable(),
  sortOrder: z.number().int().min(0).max(10000), isFeatured: z.boolean(),
  seoTitle: z.string().max(70).nullable(), seoDescription: z.string().max(180).nullable(), canonicalUrl: z.string().url().nullable(),
}).strict().superRefine((value, context) => {
  if (value.status === "scheduled" && !value.scheduledAt) {
    context.addIssue({ code: "custom", path: ["scheduledAt"], message: "Thiết bị hẹn giờ cần có thời điểm xuất bản." });
  }
});
export type EquipmentInput = z.infer<typeof equipmentInputSchema>;
export type EquipmentGroupInput = z.infer<typeof equipmentGroupInputSchema>;
