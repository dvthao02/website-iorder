// Chuỗi số liệu theo ngày cho biểu đồ Tổng quan. Ngày tính theo giờ Việt Nam (UTC+7, không đổi giờ mùa) để "hôm nay" khớp với người vận hành.
export type DashboardDailyPoint = { date: string; count: number };

const vietnamOffsetMs = 7 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

/** Ngày YYYY-MM-DD theo giờ Việt Nam của một thời điểm. */
export function vietnamDateKey(date: Date) {
  return new Date(date.getTime() + vietnamOffsetMs).toISOString().slice(0, 10);
}

/**
 * Chuỗi `days` ngày liên tiếp kết thúc ở ngày của `now` (cũ nhất trước). Ngày không có dòng nào là 0; dòng ngoài khoảng bị bỏ;
 * nhiều dòng cùng ngày được cộng lại (gộp nhiều bảng nội dung).
 */
export function fillDailySeries(rows: ReadonlyArray<{ date: string; count: number }>, days: number, now: Date): DashboardDailyPoint[] {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.date, (totals.get(row.date) ?? 0) + row.count);
  return Array.from({ length: days }, (_, index) => {
    const date = vietnamDateKey(new Date(now.getTime() - (days - 1 - index) * dayMs));
    return { date, count: totals.get(date) ?? 0 };
  });
}

/** Mốc thời gian bắt đầu của chuỗi (đầu ngày Việt Nam của ngày cũ nhất) để lọc ở cơ sở dữ liệu. */
export function dailySeriesStart(days: number, now: Date) {
  const oldest = new Date(now.getTime() - (days - 1) * dayMs);
  return new Date(Date.parse(`${vietnamDateKey(oldest)}T00:00:00Z`) - vietnamOffsetMs);
}
