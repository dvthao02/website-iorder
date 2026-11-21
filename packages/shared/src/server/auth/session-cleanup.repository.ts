import { sql } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";

/** Phiên hết hạn hoặc đã thu hồi được giữ thêm một ngày (xem lại sự cố đăng nhập) rồi mới xóa. */
export const sessionRetentionHours = 24;

/**
 * Xóa phiên đăng nhập đã hết hạn hoặc bị thu hồi quá `sessionRetentionHours` giờ. Phiên chỉ cần để kiểm tra đăng nhập nên bảng này
 * không có giá trị lịch sử (nhật ký đăng nhập nằm ở audit_logs). Mỗi lần xóa tối đa `limit` dòng để không giữ khóa bảng lâu.
 */
export async function cleanupExpiredSessions(now: Date, limit = 1_000, database = getDb()) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5_000) throw new Error("Giới hạn dọn phiên đăng nhập không hợp lệ.");
  const cutoff = new Date(now.getTime() - sessionRetentionHours * 3_600_000).toISOString();
  const result = await database.execute(sql`
    with stale as (
      select ctid from sessions
      where expires_at <= ${cutoff}::timestamptz or revoked_at <= ${cutoff}::timestamptz
      order by expires_at
      limit ${limit}
    )
    delete from sessions
    where ctid in (select ctid from stale)
  `);
  return result.count;
}
