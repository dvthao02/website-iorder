import { asc, desc, sql, type AnyColumn, type SQL } from "drizzle-orm";

import type { AdminListSort } from "./admin-list.contract";

/**
 * Thứ tự cho danh sách admin: khóa sort hợp lệ đứng đầu, sau đó là thứ tự mặc định (luôn kết thúc
 * bằng khóa duy nhất để phân trang ổn định). Khóa không có trong bảng ánh xạ bị bỏ qua.
 */
export function listOrder(sortable: Record<string, AnyColumn | SQL>, query: AdminListSort, fallback: SQL[]): SQL[] {
  const column = query.sort && Object.hasOwn(sortable, query.sort) ? sortable[query.sort] : undefined;
  if (!column) return fallback;
  return [query.dir === "asc" ? asc(column) : desc(column), ...fallback];
}

/** Sắp trạng thái theo vòng đời nội dung thay vì theo bảng chữ cái. */
export function workflowStatusRank(column: AnyColumn) {
  return sql`case ${column} when 'draft' then 1 when 'review' then 2 when 'scheduled' then 3 when 'published' then 4 when 'archived' then 5 else 6 end`;
}

/** Sắp chữ theo thứ tự tiếng Việt (a, ă, â, b… đ…), không phân biệt hoa thường như trình duyệt. */
export function vietnameseText(column: AnyColumn | SQL) {
  return sql`${column} collate "vi-x-icu"`;
}
