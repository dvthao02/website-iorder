import { normalizeRequestId, requestIdHeader } from "@iorder/core/server/shared/logger";
import { runWithRequestContext, type RequestContext } from "@iorder/core/server/shared/request-context";

import { getClientAddress } from "./client-address";

export function requestContextFrom(request: Request): RequestContext {
  return {
    ipAddress: getClientAddress(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip")),
    userAgent: request.headers.get("user-agent")?.trim().slice(0, 500) || null,
    requestId: normalizeRequestId(request.headers.get(requestIdHeader)),
  };
}

// Bọc route handler admin: mọi bản ghi nhật ký tạo trong request tự mang IP, thiết bị, mã request.
// Next luôn gọi handler với (request, context), kể cả khi handler không khai báo tham số.
export function withRequestContext<Args extends unknown[], Result>(handler: (...args: Args) => Promise<Result>) {
  return (...args: Args): Promise<Result> => {
    const request = args[0];
    if (!(request instanceof Request)) return handler(...args);
    return runWithRequestContext(requestContextFrom(request), () => handler(...args));
  };
}
