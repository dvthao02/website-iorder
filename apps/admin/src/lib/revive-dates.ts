// Phản hồi JSON của Backend: khóa kết thúc bằng "At" hoặc "Date" mang chuỗi ngày hợp lệ thì thành Date, kể cả khóa lồng nhau.
// Hợp đồng nào nhận dữ liệu đã qua bước này phải chấp nhận Date ở các khóa đó (ví dụ capturedAt trong ngữ cảnh liên hệ).
export function reviveDates(value: unknown, key = ""): unknown {
  if (typeof value === "string" && /(?:At|Date)$/.test(key) && !Number.isNaN(Date.parse(value))) return new Date(value);
  if (Array.isArray(value)) return value.map((item) => reviveDates(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, reviveDates(item, name)]));
  return value;
}
