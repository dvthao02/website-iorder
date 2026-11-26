import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { errorLogListQuerySchema } from "@iorder/shared/server/error-log/error-log.contract";
import { clearErrorLogs, getErrorLogsPage } from "@iorder/shared/server/error-log/error-log.service";
import { logger } from "@iorder/shared/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

// Xem nhật ký lỗi: quyền system.view (xem admin-permission.ts).
async function handleGET(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const query = errorLogListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return fail("INVALID_INPUT", "Bộ lọc nhật ký lỗi không hợp lệ.", 400);
  try {
    return NextResponse.json({ result: await getErrorLogsPage(query.data) });
  } catch (error) {
    logger.error("Không tải được nhật ký lỗi.", { request, error });
    return fail("INTERNAL_ERROR", "Không tải được nhật ký lỗi. Vui lòng thử lại.", 500);
  }
}

// Xóa nhật ký lỗi: chỉ Super Admin (module system chỉ có quyền xem, DELETE không ánh xạ quyền nào). Body: { mode: "one", id } | { mode: "all" }.
async function handleDELETE(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    return NextResponse.json(await clearErrorLogs(await request.json().catch(() => null), actor.userId));
  } catch (error) {
    if (error instanceof ZodError) return fail("INVALID_INPUT", "Yêu cầu xóa nhật ký lỗi không hợp lệ.", 400);
    logger.error("Không xóa được nhật ký lỗi.", { request, error });
    return fail("INTERNAL_ERROR", "Không xóa được nhật ký lỗi. Vui lòng thử lại.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const DELETE = withRequestContext(handleDELETE);
