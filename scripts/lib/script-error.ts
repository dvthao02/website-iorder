/**
 * Mô tả lỗi của script dòng lệnh cho người vận hành: tên lỗi, mã (ECONNREFUSED, 28P01...), thông báo và nguyên nhân gốc (error.cause).
 * Địa chỉ kết nối dạng postgres://người-dùng:mật-khẩu@máy bị che để không lộ bí mật ra terminal hay log CI.
 * Thiếu DATABASE_URL (lỗi hay gặp nhất: script không tự đọc .env) thì kèm gợi ý cách chạy.
 */
export function describeScriptError(error: unknown, scriptName = "<tên>") {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; current !== undefined && current !== null && !seen.has(current) && depth < 4; depth++) {
    seen.add(current);
    if (!(current instanceof Error)) { parts.push(String(current)); break; }
    const code = (current as { code?: unknown }).code;
    // Drizzle ghi cả câu SQL và giá trị tham số (có thể là dữ liệu khách) vào message: chỉ giữ phần "truy vấn thất bại", lý do thật nằm ở nguyên nhân gốc.
    const message = current.message.startsWith("Failed query:") ? "truy vấn SQL thất bại" : current.message;
    const label = [current.name !== "Error" ? current.name : "", typeof code === "string" ? `[${code}]` : "", message].filter(Boolean).join(" ");
    if (label) parts.push(label);
    current = current.cause;
  }
  const text = (parts.join(" ← ") || "lỗi không rõ").replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"')]+/gi, "<địa chỉ đã ẩn>");
  const hint = /DATABASE_URL/.test(text) ? `\nGợi ý: script không tự đọc .env. Chạy: node --env-file=.env --import tsx scripts/${scriptName}.ts (hoặc đặt DATABASE_URL trong shell).` : "";
  return text + hint;
}
