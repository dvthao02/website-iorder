import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { revisionTargetSchema, restoreRevisionSchema } from "@iorder/core/server/revisions/revisions.contract";
import { getRevisionHistory, restoreRevision } from "@iorder/core/server/revisions/revisions.service";

type Context = { params: Promise<{ target: string; id: string }> };
const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

async function handle(request: Request, context: Context, restore: boolean) {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const params = await context.params;
  const parsed = z.object({ target: revisionTargetSchema, id: z.string().uuid() }).safeParse(params);
  if (!parsed.success) return fail("INVALID_INPUT", "Nội dung cần xem lịch sử không hợp lệ.", 400);
  const { target, id } = parsed.data;
  try {
    if (!restore) return NextResponse.json({ revisions: await getRevisionHistory(target, id) });
    const body = restoreRevisionSchema.parse(await request.json());
    const result = await restoreRevision(target, id, body.revisionId, user.userId);
    if (!result) return fail("NOT_FOUND", "Không tìm thấy nội dung hoặc phiên bản cần khôi phục.", 404);
    revalidatePath("/", "layout");
    return NextResponse.json({ restored: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Phiên bản không phù hợp với cấu trúc hiện tại. Vui lòng kiểm tra nội dung và ảnh liên kết.", 400);
    return fail("INTERNAL_ERROR", "Không thể xử lý lịch sử nội dung lúc này.", 500);
  }
}

export const GET = (request: Request, context: Context) => handle(request, context, false);
export const POST = (request: Request, context: Context) => handle(request, context, true);
