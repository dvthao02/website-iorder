import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { setAdminPostLock } from "@iorder/shared/server/posts/posts.service";
import { logger } from "@iorder/shared/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

const bodySchema = z.object({ locked: z.boolean() }).strict();
const error = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

// Khóa hoặc mở khóa một bài viết/hướng dẫn (quyền posts.lock, kiểm ở proxy). Khóa không đổi nội dung hay phiên bản và không làm mới cache website:
// bài vẫn hiển thị như cũ, chỉ không ai sửa, đổi trạng thái hay xóa được cho tới khi mở khóa.
async function handlePOST(request: Request, context: { params: Promise<{ id: string }> }) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return error("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("INVALID_INPUT", "Thao tác khóa không hợp lệ.", 400);
  try {
    const { id } = await context.params;
    const result = await setAdminPostLock(id, parsed.data.locked, administrator.userId);
    return result ? NextResponse.json({ post: { id: result.id, lockedAt: result.lockedAt?.toISOString() ?? null } }) : error("NOT_FOUND", "Không tìm thấy bài viết.", 404);
  } catch (caught) {
    logger.error("Khóa/mở khóa bài viết thất bại.", { request, error: caught });
    return error("INTERNAL_ERROR", "Không thể khóa hoặc mở khóa bài viết lúc này.", 500);
  }
}

export const POST = withRequestContext(handlePOST);
