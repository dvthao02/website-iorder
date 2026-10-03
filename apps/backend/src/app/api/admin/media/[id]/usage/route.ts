import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getAdminMediaUsage } from "@iorder/core/server/media/media.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const administrator = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!administrator) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Mã tệp không hợp lệ.", 400);
  try {
    const usage = await getAdminMediaUsage(id);
    return usage ? NextResponse.json(usage) : fail("NOT_FOUND", "Không tìm thấy tệp.", 404);
  } catch {
    return fail("INTERNAL_ERROR", "Không thể kiểm tra nơi đang sử dụng tệp.", 500);
  }
}
