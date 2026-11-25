import { NextResponse, type NextRequest } from "next/server";
import { getEnabledRedirect } from "@/lib/backend";
import { builtInRedirect, redirectLoopsBack } from "@iorder/shared/server/shared/legacy-paths";
import { logger } from "@iorder/shared/server/shared/logger";
import { builderPreviewHeader, fetchBuilderPreview } from "@/lib/builder-preview";
import { localeCookieString } from "@/lib/locale-cookie";
import { isSiteLocale } from "@iorder/shared/server/translations/locales";

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

  // Chọn ngôn ngữ bằng liên kết ?lang=en (nút đổi ngôn ngữ, hoặc liên kết chia sẻ): ghi cookie rồi chuyển về đúng địa chỉ không có ?lang để mỗi trang chỉ có một URL
  // (slug không đổi theo ngôn ngữ; công cụ tìm kiếm không gửi cookie nên vẫn thấy tiếng Việt). Giá trị lạ thì chỉ bỏ ?lang, không đổi cookie.
  if (request.nextUrl.searchParams.has("lang")) {
    const chosen = request.nextUrl.searchParams.get("lang");
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("lang");
    const response = NextResponse.redirect(clean, 302);
    if (isSiteLocale(chosen)) {
      const secure = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
      // OpenNext chạy proxy Node.js ở Worker; ghi chuỗi Set-Cookie trực tiếp tránh adapter phải chuyển đổi ResponseCookies.
      response.headers.set("set-cookie", localeCookieString(chosen, secure));
    }
    response.headers.set("cache-control", "private, no-store");
    return response;
  }

  // Redirects are an optimisation for old URLs; a Backend outage must not block every page.
  let redirect: Awaited<ReturnType<typeof getEnabledRedirect>> = null;
  try {
    redirect = await getEnabledRedirect(request.nextUrl.pathname);
  } catch (error) {
    logger.error("Không kiểm tra được chuyển hướng URL từ Backend; tiếp tục hiển thị trang.", { request, error });
  }
  // Dòng chuyển hướng lưu từ trước khi CMS kiểm tra vòng lặp (ví dụ /privacy-policy → /chinh-sach-bao-mat, mà /chinh-sach-bao-mat lại bị chuyển về /privacy-policy)
  // làm trình duyệt lặp vô hạn và trang không mở được. Bỏ qua dòng đó để trang vẫn hiển thị; CMS cũng không cho lưu dòng như vậy nữa.
  if (redirect && redirectLoopsBack(pathname, redirect.destinationPath)) {
    logger.warn("Bỏ qua chuyển hướng URL vì đích quay về chính đường dẫn này; hãy xóa hoặc sửa dòng đó trong CMS.", { request, sourcePath: pathname, destinationPath: redirect.destinationPath });
    redirect = null;
  }
  if (redirect) {
    const destination = new URL(redirect.destinationPath, request.url);
    destination.search = request.nextUrl.search;
    return NextResponse.redirect(destination, redirect.statusCode);
  }

  // URL tiếng Việt cũ (/tin-tuc, /gioi-thieu…) → URL tiếng Anh chuẩn (/news, /about…), để mỗi trang chỉ có một địa chỉ. Chạy sau bảng redirects của CMS.
  // Cùng lượt còn đưa URL viết hoa (/NEWS) về chữ thường, vì Next khớp route không phân biệt hoa thường và một trang sẽ có hai địa chỉ.
  // Quy tắc nằm ở packages/shared (builtInRedirect) để CMS biết và không cho lưu chuyển hướng tạo vòng lặp với chúng.
  const canonical = builtInRedirect(pathname);
  if (!canonical) return NextResponse.next({ request: { headers: forwarded } });
  const destination = new URL(canonical, request.url);
  destination.search = request.nextUrl.search;
  return NextResponse.redirect(destination, 301);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
