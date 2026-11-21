import { NextResponse } from "next/server";
import { z } from "zod";

import { AccountUnavailableError, ProfileEmailInUseError } from "@iorder/shared/server/auth/account.contract";
import { updateOwnProfile } from "@iorder/shared/server/auth/account.service";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { logger } from "@iorder/shared/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

// Mọi tài khoản đã đăng nhập tự sửa hồ sơ của mình (họ tên, email, số điện thoại); không cần quyền "Người dùng CMS".
async function handlePATCH(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  let input: unknown;
  try { input = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400); }
  try {
    return NextResponse.json({ profile: await updateOwnProfile(actor, input) });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) return fail("INVALID_INPUT", error.issues[0]?.message ?? "Thông tin hồ sơ không hợp lệ.", 400);
    if (error instanceof ProfileEmailInUseError) return fail("EMAIL_IN_USE", error.message, 409);
    if (error instanceof AccountUnavailableError) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
    logger.error("Cập nhật hồ sơ tài khoản thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể lưu hồ sơ lúc này. Vui lòng thử lại.", 500);
  }
}

export const PATCH = withRequestContext(handlePATCH);
