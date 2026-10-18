import { NextResponse } from "next/server";

import { administratorLoginSchema } from "@iorder/core/server/auth/auth.schema";
import { InvalidAdministratorCredentialsError } from "@iorder/core/server/auth/auth.errors";
import { LoginRateLimitError } from "@iorder/core/server/auth/login-throttle";
import {
  administratorSessionCookieName,
  administratorSessionMaxAgeSeconds,
  signInAdministrator,
  signOutAdministrator,
} from "@iorder/core/server/auth/auth.service";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getClientAddress } from "@/lib/client-address";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

const sessionCookie = {
  httpOnly: true,
  maxAge: administratorSessionMaxAgeSeconds,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function phanHoiLoi(ma: string, thongBao: string, trangThai: number) {
  return NextResponse.json(
    { error: { code: ma, message: thongBao } },
    { status: trangThai },
  );
}

function chuyenHuongBieuMau(duongDan: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: duongDan },
  });
}

async function handlePOST(request: Request) {
  const laBieuMauTrinhDuyet = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") ?? false;
  let body: unknown;

  try {
    body = laBieuMauTrinhDuyet ? Object.fromEntries(await request.formData()) : await request.json();
  } catch {
    return phanHoiLoiBieuMauHoacJson(request, laBieuMauTrinhDuyet, "INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const parsed = administratorLoginSchema.safeParse(body);

  if (!parsed.success) {
    return phanHoiLoiBieuMauHoacJson(
      request,
      laBieuMauTrinhDuyet,
      "INVALID_INPUT",
      "Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.",
      400,
    );
  }

  try {
    const userAgent = request.headers.get("user-agent")?.slice(0, 500);
    const session = await signInAdministrator(parsed.data, userAgent, getClientAddress(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip")));
    const response = laBieuMauTrinhDuyet
      ? chuyenHuongBieuMau("/admin")
      : NextResponse.json({ user: session.user });

    response.cookies.set(administratorSessionCookieName, session.token, {
      ...sessionCookie,
      expires: session.expiresAt,
    });

    return response;
  } catch (error) {
    if (error instanceof LoginRateLimitError) {
      const response = phanHoiLoiBieuMauHoacJson(request, laBieuMauTrinhDuyet, "RATE_LIMITED", "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.", laBieuMauTrinhDuyet ? 303 : 429);
      if (!laBieuMauTrinhDuyet) response.headers.set("retry-after", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof InvalidAdministratorCredentialsError) {
      return phanHoiLoiBieuMauHoacJson(request, laBieuMauTrinhDuyet, "INVALID_CREDENTIALS", error.message, 401);
    }

    logger.error("Đăng nhập quản trị thất bại.", { request, error });
    return phanHoiLoiBieuMauHoacJson(
      request,
      laBieuMauTrinhDuyet,
      "INTERNAL_ERROR",
      "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
      500,
    );
  }
}

function phanHoiLoiBieuMauHoacJson(
  request: Request,
  laBieuMauTrinhDuyet: boolean,
  ma: string,
  thongBao: string,
  trangThai: number,
) {
  if (!laBieuMauTrinhDuyet) {
    return phanHoiLoi(ma, thongBao, trangThai);
  }

  return chuyenHuongBieuMau(`/admin/login?error=${encodeURIComponent(ma)}`);
}

async function handleDELETE(request: Request) {
  await signOutAdministrator(request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${administratorSessionCookieName}=([^;]*)`))?.[1]);

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(administratorSessionCookieName, "", { ...sessionCookie, maxAge: 0 });
  return response;
}

// Current administrator for the CMS shell. Needs only a valid session, not a
// module permission, so roles without dashboard access can still use the CMS.
async function handleGET() {
  const administrator = await getRequestAdministrator();
  if (!administrator) return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  return NextResponse.json({ administrator });
}

export const POST = withRequestContext(handlePOST);
export const DELETE = withRequestContext(handleDELETE);
export const GET = withRequestContext(handleGET);
