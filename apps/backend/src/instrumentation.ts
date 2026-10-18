import type { Instrumentation } from "next";

import { logUnhandledRequestError } from "@iorder/core/server/shared/logger";

// Tên service trong mỗi dòng log; production đặt qua SERVICE_NAME trong Compose.
export function register() {
  process.env.SERVICE_NAME ??= "backend";
}

// Lỗi mà route/trang không tự bắt: ghi một dòng log có requestId, route và stack.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logUnhandledRequestError(error, request, context);
};
