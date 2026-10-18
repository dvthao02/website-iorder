import { NextResponse } from "next/server";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { revisionTargetSchema, restoreRevisionSchema } from "@iorder/core/server/revisions/revisions.contract";
import { getRevisionHistory, restoreRevision } from "@iorder/core/server/revisions/revisions.service";
import { EquipmentVersionConflictError } from "@iorder/core/server/equipment/equipment-version";
import { PageVersionConflictError } from "@iorder/core/server/pages/page-version";
import { ContentVersionConflictError } from "@iorder/core/server/shared/content-version";
import { NavigationVersionConflictError } from "@iorder/core/server/navigation/navigation.service";
import { SupportDownloadVersionConflictError } from "@iorder/core/server/support/support-downloads.service";
import { denyUnless } from "@/lib/admin-access";
import { revisionTargetModules } from "@/lib/admin-permission";
import type { CmsPermissionCode } from "@iorder/core/server/auth/permissions";

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
    if (target === "equipment" && body.expectedVersion === undefined) return fail("INVALID_INPUT", "Vui lòng tải lại thiết bị trước khi khôi phục phiên bản.", 400);
    if (target === "pages" && body.expectedVersion === undefined) return fail("INVALID_INPUT", "Vui lòng tải lại trang trước khi khôi phục phiên bản.", 400);
    if ((target === "posts" || target === "offerings") && body.expectedVersion === undefined) return fail("INVALID_INPUT", "Vui lòng tải lại nội dung trước khi khôi phục phiên bản.", 400);
    // Restoring can change what is live, so publishable modules require publish.
    const targetModule = revisionTargetModules[target];
    const denied = denyUnless(user, (targetModule === "navigation" ? "navigation.update" : `${targetModule}.publish`) as CmsPermissionCode, "Bạn không có quyền khôi phục phiên bản của nội dung này.");
    if (denied) return denied;
    const result = await restoreRevision(target, id, body.revisionId, user.userId, body.expectedVersion);
    if (!result) return fail("NOT_FOUND", "Không tìm thấy nội dung hoặc phiên bản cần khôi phục.", 404);
    revalidatePath("/", "layout");
    return NextResponse.json({ restored: true });
  } catch (error) {
    if (error instanceof NavigationVersionConflictError || error instanceof SupportDownloadVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof PageVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof EquipmentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Phiên bản không phù hợp với cấu trúc hiện tại. Vui lòng kiểm tra nội dung và ảnh liên kết.", 400);
    return fail("INTERNAL_ERROR", "Không thể xử lý lịch sử nội dung lúc này.", 500);
  }
}

export const GET = (request: Request, context: Context) => handle(request, context, false);
export const POST = (request: Request, context: Context) => handle(request, context, true);
