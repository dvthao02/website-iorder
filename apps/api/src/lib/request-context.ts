import { logger, normalizeRequestId, requestIdHeader } from "@iorder/shared/server/shared/logger";
import { runWithRequestContext, type RequestContext } from "@iorder/shared/server/shared/request-context";

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
    const context = requestContextFrom(request);
    return runWithRequestContext(context, async () => {
      const result = await handler(...args);
      await recordUnloggedServerError(request, context, result);
      return result;
    });
  };
}

/**
 * Lưới an toàn cho Nhật ký lỗi: route trả 5xx mà không tự ghi log (một số route chỉ trả thông báo) thì ghi một dòng lỗi kèm mã và câu báo lỗi
 * trong phản hồi, để người vận hành vẫn biết thao tác nào hỏng. Route đã gọi logger.error (có stack, lỗi gốc) thì bỏ qua, khỏi ghi trùng.
 */
export async function recordUnloggedServerError(request: Request, context: RequestContext, result: unknown) {
  if (!(result instanceof Response) || result.status < 500 || context.errorLogged) return;
  const payload: unknown = await result.clone().json().catch(() => null);
  const error = payload && typeof payload === "object" && "error" in payload && payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : undefined;
  logger.error("Route trả lỗi máy chủ nhưng không ghi chi tiết.", {
    request,
    status: result.status,
    errorCode: typeof error?.code === "string" ? error.code : undefined,
    errorMessage: typeof error?.message === "string" ? error.message : undefined,
  });
}
