import { z } from "zod";

import type { CmsModuleKey } from "../auth/permissions";
import type { ImportPlan, ImportResult } from "./transfer";

// Bảng xuất/nhập được và module quyền của từng bảng (proxy Backend dùng để kiểm view / create|update).
export const transferDatasetModules = {
  equipment: "equipment",
  "equipment-groups": "equipment",
  "offerings-software": "offerings",
  "offerings-solution": "offerings",
  "offerings-service": "offerings",
  posts: "posts",
  guides: "posts",
  categories: "taxonomy",
  tags: "taxonomy",
} as const satisfies Record<string, CmsModuleKey>;

/** Bảng có thêm định dạng "word": gói .zip mỗi bài một file .docx. */
export const wordExportDatasets = ["posts", "guides"] as const satisfies readonly TransferDatasetId[];

export type TransferDatasetId = keyof typeof transferDatasetModules;
export const transferDatasetSchema = z.enum(Object.keys(transferDatasetModules) as [TransferDatasetId, ...TransferDatasetId[]]);
export const transferFormatSchema = z.enum(["xlsx", "csv", "word"]);

/** Phiên bản từng dòng lúc xem trước (slug → version; null = dòng tạo mới), gửi lại khi áp dụng. */
export const importExpectedSchema = z.record(z.string().max(180), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable());

export const importPlanSchema = z.object({
  dataset: z.string(),
  total: z.number().int().nonnegative(),
  counts: z.object({ create: z.number().int().nonnegative(), update: z.number().int().nonnegative(), unchanged: z.number().int().nonnegative(), error: z.number().int().nonnegative() }),
  fileErrors: z.array(z.string()),
  ignoredHeaders: z.array(z.string()),
  rows: z.array(z.object({
    row: z.number().int().positive(),
    slug: z.string(),
    label: z.string(),
    action: z.enum(["create", "update", "unchanged", "error"]),
    version: z.number().int().nonnegative().nullable(),
    changes: z.array(z.object({ field: z.string(), header: z.string(), before: z.string(), after: z.string() })),
    errors: z.array(z.string()),
  })),
}) satisfies z.ZodType<ImportPlan>;

export const importResultSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  failed: z.object({ row: z.number().int().positive(), slug: z.string(), message: z.string() }).nullable(),
}) satisfies z.ZodType<ImportResult>;
