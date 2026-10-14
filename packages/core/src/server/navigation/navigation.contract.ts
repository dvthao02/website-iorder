import { z } from "zod";
import { safeLinkSchema } from "@iorder/core/server/shared/url.contract";

export const navigationLinkTypeSchema = z.enum(["custom", "page", "post", "offering", "equipment"]);
export type NavigationLinkType = z.infer<typeof navigationLinkTypeSchema>;

export const navigationSchema = z.array(z.object({
  key: z.string().min(1).max(80),
  parentKey: z.string().max(80).nullable(),
  label: z.string().trim().min(1).max(180),
  url: safeLinkSchema,
  linkType: navigationLinkTypeSchema.default("custom"),
  contentId: z.string().uuid().nullable().default(null),
  target: z.enum(["_self", "_blank"]),
  isEnabled: z.boolean(),
}).strict()).max(100).superRefine((items, context) => {
  const keys = new Set<string>();
  items.forEach((item, index) => {
    if (keys.has(item.key) || (item.parentKey !== null && !keys.has(item.parentKey))) {
      context.addIssue({ code: "custom", path: [index, "parentKey"], message: "Mã mục phải duy nhất; mục cha phải đứng trước mục con." });
    }
    if (item.linkType === "custom" && item.contentId !== null) {
      context.addIssue({ code: "custom", path: [index, "contentId"], message: "Liên kết URL tùy chỉnh không dùng mã nội dung." });
    }
    if (item.linkType !== "custom" && item.contentId === null) {
      context.addIssue({ code: "custom", path: [index, "contentId"], message: "Hãy chọn nội dung đã xuất bản cho mục menu này." });
    }
    keys.add(item.key);
  });
});
export type NavigationItems = z.infer<typeof navigationSchema>;

export const navigationTargetSchema = z.object({
  id: z.string().uuid(),
  linkType: navigationLinkTypeSchema.exclude(["custom"]),
  label: z.string().min(1).max(220),
  url: safeLinkSchema,
  typeLabel: z.string().min(1).max(80),
}).strict();
export type NavigationTarget = z.infer<typeof navigationTargetSchema>;

export const navigationLocationSchema = z.enum(["header", "header_cta", "footer"]);
export type NavigationLocation = z.infer<typeof navigationLocationSchema>;

export const navigationDocumentSchema = z.object({
  id: z.string().uuid().nullable(),
  location: navigationLocationSchema,
  version: z.number().int().nonnegative(),
  items: navigationSchema,
}).strict();
export type NavigationDocument = z.infer<typeof navigationDocumentSchema>;
export function parseSavedNavigationDocument(input: unknown, previous: Pick<NavigationDocument, "id" | "location" | "version">) {
  const parsed = navigationDocumentSchema.safeParse(input);
  if (!parsed.success || !parsed.data.id || parsed.data.location !== previous.location || parsed.data.version !== previous.version + 1 || (previous.id !== null && parsed.data.id !== previous.id)) return undefined;
  return parsed.data;
}

export const navigationRequestSchema = z.object({
  location: navigationLocationSchema,
  version: z.number().int().nonnegative(),
  items: navigationSchema,
  changeNote: z.string().trim().max(500).optional(),
}).strict();
