import { NextResponse, type NextRequest } from "next/server";
import { getEnabledRedirect } from "@/lib/backend";
import { englishPathRedirect } from "@/lib/legacy-paths";
import { logger } from "@iorder/shared/server/shared/logger";
import { builderPreviewHeader, fetchBuilderPreview } from "@/lib/builder-preview";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const forwarded = new Headers(request.headers);
  forwarded.delete(builderPreviewHeader);
  if (pathname === "/cms-preview") {
    try {
      const token = request.nextUrl.searchParams.get("token");
      const preview = token ? await fetchBuilderPreview(token) : undefined;
      if (!preview || !token) return new NextResponse("Bản xem trước đã hết hạn. Hãy cập nhật lại trong CMS.", { status: 404, headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
      forwarded.set(builderPreviewHeader, token);
      const response = NextResponse.rewrite(new URL(preview.path, request.url), { request: { headers: forwarded } });
      response.headers.set("content-security-policy", `frame-ancestors ${preview.parentOrigin}`);
      response.headers.set("referrer-policy", "no-referrer");
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("x-robots-tag", "noindex, nofollow");
      return response;
    } catch { return new NextResponse("Không tải được bản xem trước. Hãy thử lại trong CMS.", { status: 503, headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } }); }
  }

  // CMS has its own app and origin. Do not query public-site redirects for
  // administrative paths when someone opens the public development port.
  if (pathname === "/login" || pathname === "/dang-nhap" || pathname.startsWith("/admin")) {
    return new NextResponse("Not found", { status: 404 });
  }

  // API calls are proxied to the backend through next.config.ts and never
  // participate in CMS URL redirects.
  if (pathname.startsWith("/api")) return NextResponse.next({ request: { headers: forwarded } });

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
  if (!canonical) return NextResponse.next({ request: { headers: forwarded } });
  const destination = new URL(canonical, request.url);
  destination.search = request.nextUrl.search;
  return NextResponse.redirect(destination, 301);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
