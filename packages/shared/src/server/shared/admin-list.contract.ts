import { z } from "zod";

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  query: z.string().trim().max(160).default(""),
  // Khóa sắp xếp do từng danh sách tự ánh xạ sang cột (danh sách trắng); khóa lạ dùng thứ tự mặc định.
  sort: z.string().trim().regex(/^[a-zA-Z]{1,40}$/).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
}).strict();

export type AdminListSort = { sort?: string; dir?: "asc" | "desc" };

/** Lấy sort/dir từ URLSearchParams để route chuyển tiếp vào query của danh sách. */
export function listSortParams(params: URLSearchParams): AdminListSort {
  return { sort: params.get("sort") ?? undefined, dir: (params.get("dir") ?? undefined) as AdminListSort["dir"] };
}

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

// Ngày dạng YYYY-MM-DD theo giờ Việt Nam; giá trị sai bị bỏ qua thay vì làm hỏng cả trang danh sách.
export const listDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00+07:00`))).optional().catch(undefined);

/** Khoảng [from 00:00, to + 1 ngày 00:00) giờ Việt Nam. */
export function vietnamDayRange(from?: string, to?: string) {
  const start = from ? new Date(`${from}T00:00:00+07:00`) : undefined;
  const end = to ? new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000) : undefined;
  return { start, end };
}
