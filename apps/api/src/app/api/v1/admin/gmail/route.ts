import { NextResponse } from "next/server";
import { z } from "zod";

import { isSuperAdmin } from "@iorder/shared/server/auth/permissions";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { ContentVersionConflictError, disconnectGmail, finishGmailConnect, getGmailStatus, GmailError, InvalidPasswordError, SecretsError, sendGmailTest, startGmailConnect, TooManyAttemptsError, updateGmailSettings } from "@iorder/shared/server/gmail/gmail";
import { gmailActionSchema } from "@iorder/shared/server/gmail/gmail.contract";
import { logger } from "@iorder/shared/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Gmail báo liên hệ mới (Cài đặt → Kết nối & khóa API). CHỈ Super Admin: đường dẫn không map permission nào nên proxy chỉ cho Super Admin
// (admin-permission.ts), ở đây kiểm lại. Không endpoint nào trả token hay mã khách bí mật; kết nối và ngắt kết nối phải nhập lại mật khẩu của chính người thao tác.
//   GET  trạng thái (đã có Client ID chưa, tài khoản đã kết nối, cài đặt CC)
//   PUT  { enabled, cc, expectedVersion }
//   POST { action: "connect", password, redirectUri } → { authUrl } để trình duyệt chuyển sang Google
//        { action: "finish", code, state } (trang callback gọi) · { action: "disconnect", password } · { action: "test" }
const noStore = { "cache-control": "no-store" };
const fail = (code: string, message: string, status: number, headers: Record<string, string> = {}) => NextResponse.json({ error: { code, message } }, { status, headers: { ...noStore, ...headers } });

async function authorize() {
  const user = await getRequestAdministrator();
  if (!user) return { response: fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401) };
  if (!isSuperAdmin(user)) return { response: fail("FORBIDDEN", "Chỉ Super Admin được quản lý kết nối Gmail.", 403) };
  return { user };
}

const gmailStatusByCode = { CLIENT_MISSING: 409, INVALID_REDIRECT: 400, STATE_INVALID: 400, NOT_CONNECTED: 409, NEEDS_RECONNECT: 409, GOOGLE_ERROR: 502 } as const;

function mapError(error: unknown, request: Request) {
  if (error instanceof InvalidPasswordError) return fail("INVALID_PASSWORD", error.message, 403);
  if (error instanceof TooManyAttemptsError) return fail("TOO_MANY_ATTEMPTS", error.message, 429, { "retry-after": String(Math.ceil(error.retryAfterSeconds)) });
  if (error instanceof GmailError) return fail(error.code, error.message, gmailStatusByCode[error.code]);
  if (error instanceof SecretsError) return fail("SECRETS_UNAVAILABLE", error.message, 503);
  if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
  if (error instanceof z.ZodError) return fail("INVALID_INPUT", error.issues[0]?.message ?? "Yêu cầu không hợp lệ.", 400);
  if (error instanceof SyntaxError) return fail("INVALID_INPUT", "Yêu cầu không hợp lệ.", 400);
  logger.error("Gmail: lỗi không xác định.", { request, error });
  return fail("INTERNAL_ERROR", "Không xử lý được yêu cầu lúc này. Vui lòng thử lại.", 500);
}

async function handleGET(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({ status: await getGmailStatus() }, { headers: noStore });
  } catch (error) {
    return mapError(error, request);
  }
}

async function handlePUT(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({ status: await updateGmailSettings(auth.user.userId, await request.json() as unknown) }, { headers: noStore });
  } catch (error) {
    return mapError(error, request);
  }
}

async function handlePOST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  try {
    const body = gmailActionSchema.parse(await request.json());
    const userId = auth.user.userId;
    switch (body.action) {
      case "connect": return NextResponse.json(await startGmailConnect({ userId, password: body.password, redirectUri: body.redirectUri }), { headers: noStore });
      case "finish": return NextResponse.json({ connection: await finishGmailConnect({ userId, code: body.code, state: body.state }) }, { headers: noStore });
      case "disconnect": await disconnectGmail({ userId, password: body.password }); return NextResponse.json({ status: await getGmailStatus() }, { headers: noStore });
      case "test": return NextResponse.json({ sent: await sendGmailTest(userId), status: await getGmailStatus() }, { headers: noStore });
    }
  } catch (error) {
    return mapError(error, request);
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
export const PUT = withRequestContext(handlePUT);
