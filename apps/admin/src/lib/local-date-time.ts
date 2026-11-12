/** datetime-local expects local wall-clock time, not UTC ISO text. */
export function formatLocalDateTime(value: Date | string | null | undefined): string {
  if (value == null) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Ngày giờ để đọc: "19/10/2026 22:15" (ngày trước, năm đủ 4 số, không bị xuống dòng giữa chừng). */
export function formatDisplayDateTime(value: Date | string | null | undefined): string {
  const local = formatLocalDateTime(value);
  if (!local) return "";
  const [day, time] = local.split("T");
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year} ${time}`;
}
