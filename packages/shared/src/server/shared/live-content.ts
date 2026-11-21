import { and, eq, isNull, lte, or, type SQL } from "drizzle-orm";

import type { offerings, pages, posts, salesEquipment } from "@iorder/shared/db/schema";

type PublishableTable = typeof pages | typeof posts | typeof offerings | typeof salesEquipment;

/**
 * Nội dung đang hiện trên website: đã xuất bản (ngày đăng không ở tương lai) hoặc hẹn giờ đã tới giờ.
 * Lọc ngay lúc truy vấn nên không cần job xuất bản. Một chỗ duy nhất để website, menu, sitemap và
 * kiểm tra SEO không lệch nhau; cùng quy tắc với isLive trong content-paths.ts (chạy trên dữ liệu đã đọc).
 */
export function liveContentCondition(table: PublishableTable, now = new Date()): SQL {
  return or(
    and(eq(table.status, "published"), or(isNull(table.publishedAt), lte(table.publishedAt, now))),
    and(eq(table.status, "scheduled"), lte(table.scheduledAt, now)),
  )!;
}
