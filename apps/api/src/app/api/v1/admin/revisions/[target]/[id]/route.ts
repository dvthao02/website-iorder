import { NextResponse } from "next/server";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { revisionTargetSchema, restoreRevisionSchema } from "@iorder/shared/server/revisions/revisions.contract";
import { getRevisionHistory, getRevisionTargetState, restoreRevision } from "@iorder/shared/server/revisions/revisions.service";
import { pagePermissionCodes } from "@iorder/shared/server/pages/pages.contract";
import { EquipmentVersionConflictError } from "@iorder/shared/server/equipment/equipment-version";
import { PageVersionConflictError } from "@iorder/shared/server/pages/page-version";
import { ContentVersionConflictError } from "@iorder/shared/server/shared/content-version";
import { NavigationVersionConflictError } from "@iorder/shared/server/navigation/navigation.service";
import { SupportDownloadVersionConflictError } from "@iorder/shared/server/support/support-downloads.service";
import { denyPublishUnless, denyUnless } from "@/lib/admin-access";
import { revisionTargetModules } from "@/lib/admin-permission";
import type { CmsPermissionCode } from "@iorder/shared/server/auth/permissions";
import { withRequestContext } from "@/lib/request-context";

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
    if (!restore) {
      // Proxy chỉ kiểm tra quyền chung của nhóm trang; xem lịch sử phải đúng quyền theo slug của trang.
      if (target === "pages") {
        const pageState = await getRevisionTargetState(target, id);
        if (pageState) {
          const deniedView = denyUnless(user, pagePermissionCodes(pageState.slug, "view"), "Bạn không có quyền xem lịch sử của trang này.");
          if (deniedView) return deniedView;
        }
      }
      return NextResponse.json({ revisions: await getRevisionHistory(target, id) });
    }
    const body = restoreRevisionSchema.parse(await request.json());
    if (target === "equipment" && body.expectedVersion === undefined) return fail("INVALID_INPUT", "Vui lòng tải lại thiết bị trước khi khôi phục phiên bản.", 400);
    if (target === "pages" && body.expectedVersion === undefined) return fail("INVALID_INPUT", "Vui lòng tải lại trang trước khi khôi phục phiên bản.", 400);
    if ((target === "posts" || target === "offerings") && body.expectedVersion === undefined) return fail("INVALID_INPUT", "Vui lòng tải lại nội dung trước khi khôi phục phiên bản.", 400);
    // Khôi phục giữ trạng thái hiện tại: bản nháp chỉ cần quyền sửa, nội dung đang/sắp hiện trên website cần quyền xuất bản.
    // Menu cần navigation.update; tệp tải về vẫn cần publish (bật/tắt hiển thị nằm trong dữ liệu khôi phục).
    const targetModule = revisionTargetModules[target];
    const state = await getRevisionTargetState(target, id);
    const updatePermission = target === "pages" ? pagePermissionCodes(state?.slug, "update") : `${targetModule}.update` as CmsPermissionCode;
    const publishPermission = target === "pages" ? pagePermissionCodes(state?.slug, "publish") : `${targetModule}.publish` as CmsPermissionCode;
    const denied = targetModule === "navigation" ? denyUnless(user, "navigation.update", "Bạn không có quyền khôi phục phiên bản của nội dung này.")
      : !state ? denyUnless(user, publishPermission, "Bạn không có quyền khôi phục phiên bản của nội dung này.")
      : denyUnless(user, updatePermission, "Bạn không có quyền khôi phục phiên bản của nội dung này.") ?? denyPublishUnless(user, publishPermission, { currentStatus: state.status });
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

const handleGET = async (request: Request, context: Context) => handle(request, context, false);
const handlePOST = async (request: Request, context: Context) => handle(request, context, true);

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
