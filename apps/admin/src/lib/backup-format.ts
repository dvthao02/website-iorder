// Định dạng hiển thị dùng chung cho màn Sao lưu & phục hồi (lịch sử, danh sách bản trên máy, thông báo).
export const backupDateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

export function formatBackupSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

/** Tên bản sao lưu (20261122T100000Z) → giờ Việt Nam; không đọc được thì trả lại nguyên văn. */
export function formatBackupStamp(stamp: string) {
  const date = new Date(stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z"));
  return Number.isNaN(date.valueOf()) ? stamp : backupDateTime.format(date);
}
