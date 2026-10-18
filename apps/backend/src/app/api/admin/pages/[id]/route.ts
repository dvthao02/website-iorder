import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { contentDeleteRequestSchema } from "@iorder/core/server/shared/content-version";
import { PageVersionConflictError } from "@iorder/core/server/pages/page-version";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { deleteArchivedAdminPage, FixedWebsitePageBindingError, getAdminPageById } from "@iorder/core/server/pages/pages.service";
import { pagePermissionCodes } from "@iorder/core/server/pages/pages.contract";
import { denyUnless } from "@/lib/admin-access";

type PageRouteProps = { params: Promise<{ id: string }> };

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_: Request, { params }: PageRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Trang cần xem không hợp lệ.", 400);
  const page = await getAdminPageById(id);
  if (!page) return fail("NOT_FOUND", "Không tìm thấy trang.", 404);
  return denyUnless(administrator, pagePermissionCodes(page.slug, "view")) ?? NextResponse.json({ page });
}

export async function DELETE(request: Request, { params }: PageRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Trang cần xóa không hợp lệ.", 400);
  const version = contentDeleteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!version.success) return fail("INVALID_INPUT", "Vui lòng tải lại danh sách để lấy phiên bản trang mới nhất trước khi xóa.", 400);

  try {
    const deleted = await deleteArchivedAdminPage(id, administrator.userId, version.data.expectedVersion);
    if (!deleted) return fail("NOT_FOUND", "Chỉ có thể xóa trang đang lưu trữ.", 404);
    revalidatePath("/", "layout");
    return NextResponse.json({ deletedId: deleted.id });
  } catch (error) {
    if (error instanceof FixedWebsitePageBindingError) return fail("FIXED_PAGE_ROUTE", error.message, 400);
    if (error instanceof PageVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    console.error("Xóa trang trong CMS thất bại.");
    return fail("INTERNAL_ERROR", "Không thể xóa trang lúc này. Vui lòng thử lại.", 500);
  }
}
