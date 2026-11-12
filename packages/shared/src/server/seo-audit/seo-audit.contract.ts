import { z } from "zod";

import type { SeoAuditResult } from "./seo-audit";

const seoIssueSchema = z.object({
  code: z.enum(["missing_description", "duplicate_title", "duplicate_description", "title_long", "description_long", "description_short", "missing_image"]),
  message: z.string(),
});

export const seoAuditResultSchema = z.object({
  checked: z.number().int().nonnegative(),
  rows: z.array(z.object({
    kind: z.enum(["page", "post", "offering", "equipment"]),
    id: z.string().uuid(),
    type: z.string().nullable(),
    label: z.string(),
    path: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    hasImage: z.boolean().nullable(),
    issues: z.array(seoIssueSchema),
  })),
}) satisfies z.ZodType<SeoAuditResult>;
