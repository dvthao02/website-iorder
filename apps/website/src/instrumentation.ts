import type { Instrumentation } from "next";

import { logUnhandledRequestError } from "@iorder/shared/server/shared/logger";

import { installDefaultFetchTimeout } from "./lib/fetch-timeout";

// Tên service trong mỗi dòng log; production đặt qua SERVICE_NAME trong Compose.
export function register() {
  process.env.SERVICE_NAME ??= "website";
  // Giới hạn thời gian cho fetch không có signal (lượt làm mới nền cache của Next); phải làm trước khi Next vá fetch.
  installDefaultFetchTimeout();
}

// Lỗi mà route/trang không tự bắt: ghi một dòng log có requestId, route và stack.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logUnhandledRequestError(error, request, context);
};
