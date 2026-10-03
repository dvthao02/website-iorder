import { z } from "zod";
import { safeLinkSchema } from "@iorder/core/server/shared/url.contract";

export const navigationSchema = z.array(z.object({
  key: z.string().min(1).max(80),
  parentKey: z.string().max(80).nullable(),
  label: z.string().trim().min(1).max(180),
  url: safeLinkSchema,
  target: z.enum(["_self", "_blank"]),
  isEnabled: z.boolean(),
}).strict()).max(100).superRefine((items, context) => {
  const keys = new Set<string>();
  items.forEach((item, index) => {
    if (keys.has(item.key) || (item.parentKey !== null && !keys.has(item.parentKey))) {
      context.addIssue({ code: "custom", path: [index, "parentKey"], message: "Mã mục phải duy nhất; mục cha phải đứng trước mục con." });
    }
    keys.add(item.key);
  });
});
export type NavigationItems = z.infer<typeof navigationSchema>;

export const navigationLocationSchema = z.enum(["header", "header_cta", "footer"]);
export type NavigationLocation = z.infer<typeof navigationLocationSchema>;

export const navigationDocumentSchema = z.object({
  id: z.string().uuid().nullable(),
  location: navigationLocationSchema,
  version: z.number().int().nonnegative(),
  items: navigationSchema,
}).strict();
export type NavigationDocument = z.infer<typeof navigationDocumentSchema>;

export const navigationRequestSchema = z.object({
  location: navigationLocationSchema,
  version: z.number().int().nonnegative(),
  items: navigationSchema,
  changeNote: z.string().trim().max(500).optional(),
}).strict();
