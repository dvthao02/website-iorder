import { NextResponse, type NextRequest } from "next/server";

import { administratorSessionCookieName, getCurrentAdministrator } from "@iorder/core/server/auth/auth.service";
import { hasCmsPermission, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { getOriginalRequestHost, isMediaUploadOriginAllowed } from "@iorder/core/server/media/media-origin";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requiredPermission(pathname: string, method: string): CmsPermissionCode {
  const mutation = mutationMethods.has(method);
  if (pathname.endsWith("/users") || pathname.endsWith("/roles")) return pathname.endsWith("/roles") ? "roles.manage" : "users.manage";
  if (pathname.endsWith("/audit")) return "audit.read";
  if (pathname.endsWith("/dashboard")) return "dashboard.read";
  if (pathname.includes("/leads")) return mutation ? "leads.write" : "leads.read";
  if (pathname.includes("/media")) return mutation ? "media.manage" : "content.read";
  if (pathname.includes("/taxonomy")) return mutation ? "taxonomy.manage" : "content.read";
  if (pathname.includes("/navigation")) return mutation ? "navigation.manage" : "content.read";
  if (pathname.includes("/redirects") || pathname.includes("/publishing-config") || pathname.includes("/external-links") || pathname.includes("/profile")) return mutation ? "seo.manage" : "content.read";
  return mutation ? "content.write" : "content.read";
}

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

  if (request.nextUrl.pathname.endsWith("/session")) return NextResponse.next();

  const actor = await getCurrentAdministrator(request.cookies.get(administratorSessionCookieName)?.value);
  if (!actor) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } },
      { status: 401 },
    );
  }

  const permission = requiredPermission(request.nextUrl.pathname, request.method);
  if (!hasCmsPermission(actor, permission)) {
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
