import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { deleteAdminMedia, editAdminMedia, getMediaById, MediaInUseError } from "@iorder/core/server/media/media.service";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

async function handleGET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!await getRequestAdministrator()) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Mã tệp không hợp lệ.", 400);
  try {
    const asset = await getMediaById(id);
    return asset ? NextResponse.json({ asset }) : fail("NOT_FOUND", "Không tìm thấy tệp.", 404);
  } catch { return fail("INTERNAL_ERROR", "Không thể tải thông tin tệp.", 500); }
}

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const administrator = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!administrator) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Mã tệp không hợp lệ.", 400);
  let input: unknown;
  try { input = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400); }
  try {
    const asset = await editAdminMedia(id, input, administrator.userId);
    if (!asset) return fail("NOT_FOUND", "Không tìm thấy tệp.", 404);
    // Alt text is rendered on public covers, logos and equipment images.
    revalidatePath("/", "layout");
    return NextResponse.json({ asset });
  } catch (error) {
    return error instanceof z.ZodError ? fail("INVALID_INPUT", "Mô tả ảnh tối đa 500 ký tự; chú thích tối đa 10.000 ký tự.", 400)
      : fail("INTERNAL_ERROR", "Không thể lưu thông tin tệp.", 500);
  }
}

async function handleDELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const administrator = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!administrator) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Mã tệp không hợp lệ.", 400);
  try {
    const queuedId = await deleteAdminMedia(id, administrator.userId);
    if (!queuedId) return fail("NOT_FOUND", "Không tìm thấy tệp cần xóa.", 404);
    return NextResponse.json({ queuedId });
  } catch (error) {
    if (error instanceof MediaInUseError) return fail("MEDIA_IN_USE", error.message, 409);
    logger.error("Xóa media trong CMS thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể xóa tệp lúc này. Vui lòng thử lại.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const PATCH = withRequestContext(handlePATCH);
export const DELETE = withRequestContext(handleDELETE);
