import { NextResponse, type NextRequest } from "next/server";

import { administratorSessionCookieName, getCurrentAdministrator } from "@iorder/core/server/auth/auth.service";
import { getOriginalRequestHost, isMediaUploadOriginAllowed } from "@iorder/core/server/media/media-origin";

import { actorMayAccess, adminMutationMethods as mutationMethods, requiredAdminPermissions } from "./lib/admin-permission";

// All CMS mutations are cookie-authenticated. Reject an explicitly cross-site
// browser request before it reaches a route handler. Requests without Origin
// keep the existing compatibility contract; SameSite cookies remain the
// fallback for those legacy/non-browser clients.
export async function proxy(request: NextRequest) {
  if (
    mutationMethods.has(request.method)
    && !isMediaUploadOriginAllowed(request.headers.get("origin"), getOriginalRequestHost(request.headers) ?? request.nextUrl.host)
  ) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Nguồn gửi yêu cầu không hợp lệ." } },
      { status: 403 },
    );
  }

  const required = requiredAdminPermissions(request.nextUrl.pathname, request.method);
  if (!required) return NextResponse.next();

  const actor = await getCurrentAdministrator(request.cookies.get(administratorSessionCookieName)?.value);
  if (!actor) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } },
      { status: 401 },
    );
  }

  if (!actorMayAccess(actor, required)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." } },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/admin/:path*",
};
