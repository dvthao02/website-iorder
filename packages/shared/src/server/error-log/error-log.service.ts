import { setErrorLogSink } from "../shared/logger";
import { errorLogClearRequestSchema, errorLogListQuerySchema } from "./error-log.contract";
import { createErrorLogSink } from "./error-log.record";
import { clearErrorLogRows, listErrorLogsPage, recordErrorLog } from "./error-log.repository";

/**
 * Bật việc lưu mọi lỗi nặng (logger.error) của Backend vào bảng error_logs, để người vận hành đọc ở CMS › Hệ thống › Nhật ký lỗi
 * thay vì phải mở log của container. Gọi một lần lúc Backend khởi động (apps/api/src/instrumentation.ts).
 */
export function installErrorLogSink() {
  setErrorLogSink(createErrorLogSink({ record: (record) => recordErrorLog(record) }));
}

export async function getErrorLogsPage(input: unknown) { return listErrorLogsPage(errorLogListQuerySchema.parse(input)); }

/** Chỉ Super Admin gọi được (xem route): module system không có quyền xóa nên DELETE không ánh xạ quyền nào. */
export async function clearErrorLogs(input: unknown, actorId: string) {
  return clearErrorLogRows(errorLogClearRequestSchema.parse(input), actorId);
}
