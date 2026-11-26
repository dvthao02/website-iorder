import { createHash } from "node:crypto";

import { serializeError, type LogEntry } from "../shared/logger";
import { errorLogDetailsSchema, type ErrorLogDetails, type LogError } from "./error-log.contract";

// Biến một dòng log mức error thành một dòng nhật ký lỗi. Phần thuần (không database) nằm ở đây để kiểm thử được; việc ghi nằm ở error-log.repository.ts.

export type ErrorLogRecord = {
  fingerprint: string;
  message: string;
  errorName: string | null;
  errorMessage: string | null;
  method: string | null;
  path: string | null;
  requestId: string | null;
  details: ErrorLogDetails;
};

const reservedFields = new Set(["time", "level", "service", "msg", "requestId", "method", "path", "err"]);
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Bỏ phần đổi theo từng lần (mã, số, id) để cùng một lỗi luôn cho cùng một dấu vân tay. */
export function normalizeForFingerprint(text: string) {
  return text.replace(uuidPattern, ":id").replace(/\b\d{2,}\b/g, "#");
}

const text = (value: unknown, max: number) => typeof value === "string" && value ? value.slice(0, max) : null;

function rootCause(error: LogError | undefined): LogError | undefined {
  let current = error;
  while (current?.cause) current = current.cause;
  return current;
}

export function buildErrorLogRecord(entry: LogEntry): ErrorLogRecord {
  const message = text(entry.msg, 500) ?? "Lỗi không rõ";
  const error = entry.err && typeof entry.err === "object" ? entry.err as LogError : undefined;
  const method = text(entry.method, 12);
  const path = text(entry.path, 400);
  const root = rootCause(error);
  const errorName = text(error?.name, 160);
  // Không có lỗi tuần tự hóa (route chỉ trả 5xx, xem withRequestContext): dùng câu báo lỗi nằm trong phản hồi.
  const errorMessage = text(error?.message, 2000) ?? text(entry.errorMessage, 2000);
  const fingerprint = createHash("sha256")
    .update([message, errorName ?? "", normalizeForFingerprint(root?.message ?? ""), method ?? "", normalizeForFingerprint(path ?? "")].join("\u0000"))
    .digest("hex");
  const context = Object.fromEntries(Object.entries(entry).filter(([key, value]) => !reservedFields.has(key) && value !== undefined));
  const parsed = errorLogDetailsSchema.safeParse({ error, context });
  return {
    fingerprint, message, errorName, errorMessage, method, path,
    requestId: text(entry.requestId, 128),
    // Chi tiết sai hình dạng (không nên xảy ra) vẫn được ghi, chỉ mất phần lỗi tuần tự hóa, không làm mất cả dòng.
    details: parsed.success ? parsed.data : { context },
  };
}

export type ErrorLogSinkDependencies = {
  record: (record: ErrorLogRecord) => Promise<void>;
  now?: () => number;
  /** Trần số lần ghi mỗi phút của một tiến trình: lúc sự cố nổ ra hàng loạt thì database không bị gọi thêm hàng nghìn lần. */
  maxPerMinute?: number;
  /** Báo lỗi ghi nhật ký; không được dùng logger.error (sẽ lặp vô hạn). */
  report?: (error: unknown) => void;
};

export function createErrorLogSink({ record, now = Date.now, maxPerMinute = 60, report = (error) => console.error(JSON.stringify({ time: new Date().toISOString(), level: "error", msg: "Không ghi được nhật ký lỗi vào database.", logFailure: true, reason: String(serializeError(error).message).slice(0, 200) })) }: ErrorLogSinkDependencies) {
  let windowStart = 0;
  let count = 0;
  return (entry: LogEntry) => {
    const current = now();
    if (current - windowStart >= 60_000) { windowStart = current; count = 0; }
    if (++count > maxPerMinute) return;
    // Không chờ: việc ghi nhật ký không được làm chậm hay làm hỏng request đang xử lý.
    void Promise.resolve().then(() => record(buildErrorLogRecord(entry))).catch(report);
  };
}
