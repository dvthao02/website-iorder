import { NextResponse } from "next/server";
import { z } from "zod";

import { getMediaById } from "@iorder/core/server/media/media.service";
import { logger } from "@iorder/core/server/shared/logger";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Mã tệp không hợp lệ.", 400);
  try {
    const asset = await getMediaById(id);
    return asset ? NextResponse.json({ asset }) : fail("NOT_FOUND", "Không tìm thấy tệp.", 404);
  } catch (error) {
    logger.error("Đọc thông tin tệp public thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể tải thông tin tệp lúc này.", 500);
  }
}
