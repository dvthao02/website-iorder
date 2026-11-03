import { NextResponse } from "next/server";
import { z } from "zod";

import { denyUnless } from "@/lib/admin-access";
import { withRequestContext } from "@/lib/request-context";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { exportPostWord } from "@iorder/core/server/data-transfer/word.service";
import { logger } from "@iorder/core/server/shared/logger";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Tải một bài viết/hướng dẫn thành file Word (.docx): tiêu đề, nội dung, ảnh PNG/JPEG/GIF nhúng sẵn.
async function handleGET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const denied = denyUnless(administrator, "posts.view");
  if (denied) return denied;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Bài viết không hợp lệ.", 400);
  try {
    const file = await exportPostWord(id);
    if (!file) return fail("NOT_FOUND", "Không tìm thấy bài viết.", 404);
    return new NextResponse(new Uint8Array(file.body), { headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${file.fileName}"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    logger.error("Xuất bài viết ra Word thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể xuất file Word lúc này. Vui lòng thử lại.", 500);
  }
}

export const GET = withRequestContext(handleGET);
