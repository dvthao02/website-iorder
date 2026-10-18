import { NextResponse } from "next/server";
import { z } from "zod";

import { CurrentPasswordMismatchError } from "@iorder/core/server/auth/account.contract";
import { changeOwnPassword } from "@iorder/core/server/auth/account.service";
import { LoginRateLimitError } from "@iorder/core/server/auth/login-throttle";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getClientAddress } from "@/lib/client-address";
import { logger } from "@iorder/core/server/shared/logger";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Mọi tài khoản đã đăng nhập tự đổi mật khẩu của mình; không cần quyền "Người dùng CMS".
export async function POST(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const revokedSessions = await changeOwnPassword(actor, await request.json(), getClientAddress(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip")));
    return NextResponse.json({ ok: true, revokedSessions });
  } catch (error: unknown) {
    if (error instanceof CurrentPasswordMismatchError) return fail("INVALID_CURRENT_PASSWORD", error.message, 400);
    if (error instanceof LoginRateLimitError) {
      const response = fail("RATE_LIMITED", "Nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.", 429);
      response.headers.set("retry-after", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof z.ZodError) return fail("INVALID_INPUT", error.issues[0]?.message ?? "Mật khẩu không hợp lệ.", 400);
    if (error instanceof SyntaxError) return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
    logger.error("Đổi mật khẩu tài khoản thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể đổi mật khẩu lúc này. Vui lòng thử lại.", 500);
  }
}
