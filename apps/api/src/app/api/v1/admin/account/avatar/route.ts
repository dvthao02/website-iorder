import { NextResponse } from "next/server";

import { AccountUnavailableError } from "@iorder/shared/server/auth/account.contract";
import { removeOwnAvatar, setOwnAvatar } from "@iorder/shared/server/auth/account.service";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { avatarUploadOptions, InvalidMediaError } from "@iorder/shared/server/media/media.service";
import { logger } from "@iorder/shared/server/shared/logger";
import { readUploadedFile } from "@/lib/read-upload";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

// Mọi tài khoản đã đăng nhập tự đổi ảnh đại diện của mình; không cần quyền thư viện media (ảnh vẫn nằm trong thư viện, thư mục avatars).
async function handlePOST(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const upload = await readUploadedFile(request, avatarUploadOptions.maxBytes, "Ảnh đại diện không được vượt quá 2 MB.");
  if (!upload.ok) return fail(upload.code, upload.message, upload.code === "PAYLOAD_TOO_LARGE" ? 413 : 400);
  try {
    return NextResponse.json(await setOwnAvatar(actor, upload.file), { status: 201 });
  } catch (error: unknown) {
    if (error instanceof InvalidMediaError) return fail("INVALID_INPUT", error.message, 400);
    if (error instanceof AccountUnavailableError) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
    logger.error("Đổi ảnh đại diện thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể đổi ảnh đại diện lúc này. Vui lòng thử lại.", 500);
  }
}

async function handleDELETE(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    await removeOwnAvatar(actor);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof AccountUnavailableError) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
    logger.error("Xóa ảnh đại diện thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể xóa ảnh đại diện lúc này. Vui lòng thử lại.", 500);
  }
}

export const POST = withRequestContext(handlePOST);
export const DELETE = withRequestContext(handleDELETE);
