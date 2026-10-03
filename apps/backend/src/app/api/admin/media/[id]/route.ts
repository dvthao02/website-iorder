import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { editAdminMedia } from "@iorder/core/server/media/media.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const administrator = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!administrator) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Mã tệp không hợp lệ.", 400);
  let input: unknown;
  try { input = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400); }
  try {
    const asset = await editAdminMedia(id, input, administrator.userId);
    return asset ? NextResponse.json({ asset }) : fail("NOT_FOUND", "Không tìm thấy tệp.", 404);
  } catch (error) {
    return error instanceof z.ZodError ? fail("INVALID_INPUT", "Mô tả ảnh tối đa 500 ký tự; chú thích tối đa 10.000 ký tự.", 400)
      : fail("INTERNAL_ERROR", "Không thể lưu thông tin tệp.", 500);
  }
}
