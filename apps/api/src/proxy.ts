import { NextResponse, type NextRequest } from "next/server";

import { administratorSessionCookieName, getCurrentAdministrator } from "@iorder/shared/server/auth/auth.service";
import { getOriginalRequestHost, isMediaUploadOriginAllowed } from "@iorder/shared/server/media/media-origin";
import { logger, requestIdHeader, resolveRequestId } from "@iorder/shared/server/shared/logger";
import { rateLimitMessage } from "@iorder/shared/server/shared/rate-limit";

import { getClientAddress } from "./lib/client-address";
import { apiRateLimiter, isRateLimitDisabled, rateLimitFor } from "./lib/rate-limit-policy";

import { actorMayAccess, adminMutationMethods as mutationMethods, requiredAdminPermissions } from "./lib/admin-permission";

// All CMS mutations are cookie-authenticated. Reject an explicitly cross-site
// browser request before it reaches a route handler. Requests without Origin
// keep the existing compatibility contract; SameSite cookies remain the
// fallback for those legacy/non-browser clients.
export async function proxy(request: NextRequest) {
  // Mọi request mang một mã định danh (nhận từ Caddy/CMS hoặc tạo mới) để nối log giữa các app.
  const requestId = resolveRequestId(request.headers);
  const forwarded = new Headers(request.headers);
  forwarded.set(requestIdHeader, requestId);
  const tagged = (response: NextResponse) => { response.headers.set(requestIdHeader, requestId); return response; };
  const pass = () => tagged(NextResponse.next({ request: { headers: forwarded } }));
  const logged = { headers: forwarded, method: request.method, url: request.url };

  // Chặn request dồn dập theo IP trước khi chạm DB/S3 (kiểm phiên bên dưới cũng là một truy vấn DB cho mỗi request).
  // Request không có IP (website và CMS gọi Backend từ phía server, không qua Caddy) không bị giới hạn.
  const clientIp = getClientAddress(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip"));
  const limit = clientIp && !isRateLimitDisabled() ? rateLimitFor(request.nextUrl.pathname, request.method) : null;
  if (clientIp && limit) {
    const decision = apiRateLimiter.consume(`${limit.group}:${clientIp}`, limit);
    if (!decision.allowed) {
      // Chỉ ghi lần đầu của mỗi cửa sổ để bị tấn công không làm ngập log.
      if (decision.firstRejection) logger.warn("Từ chối request vì vượt hạn mức.", { request: logged, group: limit.group, limit: limit.limit, ip: clientIp });
      const retryAfter = String(decision.retryAfterSeconds);
      // Form đăng nhập của trình duyệt (không phải fetch) cần quay về trang đăng nhập thay vì hiện JSON thô.
      if (limit.group === "login" && request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
        return tagged(new NextResponse(null, { status: 303, headers: { Location: "/admin/login?error=RATE_LIMITED", "Retry-After": retryAfter } }));
      }
      return tagged(NextResponse.json(
        { error: { code: "RATE_LIMITED", message: rateLimitMessage(decision.retryAfterSeconds) } },
        { status: 429, headers: { "Retry-After": retryAfter } },
      ));
    }
  }

  if (!request.nextUrl.pathname.startsWith("/api/v1/admin")) return pass();

  if (
    mutationMethods.has(request.method)
    && !isMediaUploadOriginAllowed(request.headers.get("origin"), getOriginalRequestHost(request.headers) ?? request.nextUrl.host)
  ) {
    logger.warn("Từ chối mutation khác nguồn.", { request: logged, origin: request.headers.get("origin") });
    return tagged(NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Nguồn gửi yêu cầu không hợp lệ." } },
      { status: 403 },
    ));
  }

  const required = requiredAdminPermissions(request.nextUrl.pathname, request.method);
  if (!required) return pass();

  let actor: Awaited<ReturnType<typeof getCurrentAdministrator>>;
  try {
    actor = await getCurrentAdministrator(request.cookies.get(administratorSessionCookieName)?.value);
  } catch (error) {
    logger.error("Không kiểm tra được phiên đăng nhập CMS.", { request: logged, error });
    return tagged(NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Hệ thống tạm thời không phản hồi. Vui lòng thử lại sau ít phút." } },
      { status: 503 },
    ));
  }
  if (!actor) {
    return tagged(NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } },
      { status: 401 },
    ));
  }

  if (!actorMayAccess(actor, required)) {
    logger.warn("Từ chối truy cập do thiếu quyền.", { request: logged, userId: actor.userId, username: actor.username, required });
    return tagged(NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." } },
      { status: 403 },
    ));
  }

  return pass();
}

export const config = {
  // Toàn bộ API và media nhận request id; kiểm tra quyền chỉ áp dụng cho /api/v1/admin.
  matcher: ["/api/:path*", "/media/:path*"],
};
