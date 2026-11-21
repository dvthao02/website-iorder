import { z } from "zod";

import type { SeoAuditResult } from "./seo-audit";

const seoIssueSchema = z.object({
  code: z.enum(["noindex", "canonical_mismatch", "keyword_conflict", "missing_description", "duplicate_title", "duplicate_description", "title_long", "description_long", "description_short", "missing_image", "missing_image_alt", "content_short", "body_image_alt", "no_headings", "keyword_weak"]),
  message: z.string(),
});

const seoAuditRowSchema = z.object({
  kind: z.enum(["page", "post", "offering", "equipment"]),
  id: z.string().uuid(),
  type: z.string().nullable(),
  label: z.string(),
  path: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  hasImage: z.boolean().nullable(),
  imageHasAlt: z.boolean().nullable(),
  noindex: z.boolean(),
  canonicalUrl: z.string().nullable(),
  focusKeyword: z.string().nullable(),
  issues: z.array(seoIssueSchema),
  score: z.object({ passed: z.number().int().nonnegative(), total: z.number().int().nonnegative() }),
});

export const seoAuditResultSchema = z.object({
  checked: z.number().int().nonnegative(),
  rows: z.array(seoAuditRowSchema),
  healthy: z.array(seoAuditRowSchema),
}) satisfies z.ZodType<SeoAuditResult>;
