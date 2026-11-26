import type { Instrumentation } from "next";

import { logUnhandledRequestError } from "@iorder/shared/server/shared/logger";

// Tên service trong mỗi dòng log; production đặt qua SERVICE_NAME trong Compose.
export async function register() {
  process.env.SERVICE_NAME ??= "api";
  // Lỗi nặng (logger.error) còn được lưu vào database để đọc ở CMS › Hệ thống › Nhật ký lỗi. Chỉ chạy ở Node (Edge không có database).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installErrorLogSink } = await import("@iorder/shared/server/error-log/error-log.service");
    installErrorLogSink();
  }
}

// Lỗi mà route/trang không tự bắt: ghi một dòng log có requestId, route và stack.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logUnhandledRequestError(error, request, context);
};
