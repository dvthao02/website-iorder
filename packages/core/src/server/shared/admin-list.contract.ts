import { z } from "zod";

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  query: z.string().trim().max(160).default(""),
}).strict();

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export function createAdminListPageSchema<Item extends { id: string }>(itemSchema: z.ZodType<Item>) {
  return z.object({
    items: z.array(itemSchema), page: z.number().int().positive(), pageSize: z.number().int().min(5).max(100),
    total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), totalPages: z.number().int().positive(),
  }).superRefine((value, context) => {
    const expected = Math.max(0, Math.min(value.pageSize, value.total - (value.page - 1) * value.pageSize));
    if (value.totalPages !== Math.max(1, Math.ceil(value.total / value.pageSize)) || value.items.length !== expected || new Set(value.items.map(item => item.id)).size !== value.items.length) context.addIssue({ code: "custom", message: "Phản hồi danh sách không nhất quán." });
  });
}

export type AdminListPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function toAdminListPage<T>(items: T[], query: AdminListQuery, total: number): AdminListPage<T> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
