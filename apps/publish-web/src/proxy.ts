import { NextResponse, type NextRequest } from "next/server";
import { getEnabledRedirect } from "@/lib/backend";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CMS has its own app and origin. Do not query public-site redirects for
  // administrative paths when someone opens the public development port.
  if (pathname === "/login" || pathname.startsWith("/admin")) {
    return new NextResponse("Not found", { status: 404 });
  }

  // API calls are proxied to the backend through next.config.ts and never
  // participate in CMS URL redirects.
  if (pathname.startsWith("/api")) return NextResponse.next();

  const redirect = await getEnabledRedirect(request.nextUrl.pathname);
  if (!redirect) return NextResponse.next();
  const destination = new URL(redirect.destinationPath, request.url);
  destination.search = request.nextUrl.search;
  return NextResponse.redirect(destination, redirect.statusCode);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
