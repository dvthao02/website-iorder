// Thời gian trôi qua bằng tiếng Việt, dùng cho thông báo và danh sách CMS. Hàm thuần (giờ hiện tại truyền vào) nên kiểm thử được.
// Lệch đồng hồ (thời điểm ở tương lai) coi như vừa xong.

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

function elapsed(from: Date, now: Date) {
  return Math.max(0, now.getTime() - from.getTime());
}

/** "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", "1 tháng trước". */
export function formatTimeAgo(from: Date, now: Date) {
  const ms = elapsed(from, now);
  if (ms < minute) return "vừa xong";
  if (ms < hour) return `${Math.floor(ms / minute)} phút trước`;
  if (ms < day) return `${Math.floor(ms / hour)} giờ trước`;
  if (ms < 30 * day) return `${Math.floor(ms / day)} ngày trước`;
  return `${Math.floor(ms / (30 * day))} tháng trước`;
}

/** Khoảng đã chờ, không có chữ "trước": "5 phút", "3 giờ", "2 ngày" (tối thiểu 1 phút). */
export function formatWaitingTime(from: Date, now: Date) {
  const ms = elapsed(from, now);
  if (ms < hour) return `${Math.max(1, Math.floor(ms / minute))} phút`;
  if (ms < day) return `${Math.floor(ms / hour)} giờ`;
  return `${Math.floor(ms / day)} ngày`;
}
