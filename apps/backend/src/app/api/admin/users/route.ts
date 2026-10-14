import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { cmsUserListQuerySchema, cmsUserRequestSchema } from "@iorder/core/server/users/users.contract";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { getCmsUsersPage, saveCmsUser } from "@iorder/core/server/users/users.service";
import { CmsUserPermissionError } from "@iorder/core/server/users/users.errors";
import { hasCmsPermission } from "@iorder/core/server/auth/permissions";

export async function GET(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  if (!hasCmsPermission(actor, "users.manage")) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Bạn không có quyền quản lý tài khoản." } }, { status: 403 });
  try {
    const params = new URL(request.url).searchParams;
    const parsed = cmsUserListQuerySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Bộ lọc hoặc phân trang tài khoản không hợp lệ." } }, { status: 400 });
    return NextResponse.json({ result: await getCmsUsersPage(parsed.data) });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải danh sách tài khoản lúc này. Vui lòng thử lại." } }, { status: 500 });
  }
}
export async function POST(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  if (!hasCmsPermission(actor, "users.manage")) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Bạn không có quyền quản lý tài khoản." } }, { status: 403 });
  try {
    const body = cmsUserRequestSchema.parse(await request.json());
    const id = await saveCmsUser(body.id, body.values, actor.userId);
    if (!id) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy tài khoản cần cập nhật." } }, { status: 404 });
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof CmsUserPermissionError) return NextResponse.json({ error: { code: "FORBIDDEN", message: error.message } }, { status: 403 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Kiểm tra tên đăng nhập, vai trò, trạng thái và mật khẩu trước khi lưu." } }, { status: 400 });
    if (hasDatabaseErrorCode(error, "23505")) return NextResponse.json({ error: { code: "DUPLICATE_USER", message: "Tên đăng nhập hoặc email đã được sử dụng." } }, { status: 409 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu tài khoản lúc này." } }, { status: 500 });
  }
}
