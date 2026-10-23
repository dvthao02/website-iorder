import { NextResponse, type NextRequest } from "next/server";
import { getEnabledRedirect } from "@/lib/backend";
import { englishPathRedirect } from "@/lib/legacy-paths";
import { logger } from "@iorder/core/server/shared/logger";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CMS has its own app and origin. Do not query public-site redirects for
  // administrative paths when someone opens the public development port.
  if (pathname === "/login" || pathname === "/dang-nhap" || pathname.startsWith("/admin")) {
    return new NextResponse("Not found", { status: 404 });
  }

  // API calls are proxied to the backend through next.config.ts and never
  // participate in CMS URL redirects.
  if (pathname.startsWith("/api")) return NextResponse.next();

  // Redirects are an optimisation for old URLs; a Backend outage must not block every page.
  let redirect: Awaited<ReturnType<typeof getEnabledRedirect>> = null;
  try {
    redirect = await getEnabledRedirect(request.nextUrl.pathname);
  } catch (error) {
    logger.error("Không kiểm tra được chuyển hướng URL từ Backend; tiếp tục hiển thị trang.", { request, error });
  }
  if (redirect) {
    const destination = new URL(redirect.destinationPath, request.url);
    destination.search = request.nextUrl.search;
    return NextResponse.redirect(destination, redirect.statusCode);
  }

  // URL tiếng Anh (tên thư mục route) gõ nhầm → URL tiếng Việt chuẩn, để mỗi trang chỉ có một địa chỉ. Chạy sau bảng redirects của CMS.
  const canonical = englishPathRedirect(pathname);
  if (!canonical) return NextResponse.next();
  const destination = new URL(canonical, request.url);
  destination.search = request.nextUrl.search;
  return NextResponse.redirect(destination, 301);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
