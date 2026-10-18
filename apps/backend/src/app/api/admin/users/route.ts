import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { cmsUserListQuerySchema, cmsUserRequestSchema } from "@iorder/core/server/users/users.contract";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { getCmsUsersPage, saveCmsUser } from "@iorder/core/server/users/users.service";
import { CmsAccessError } from "@iorder/core/server/roles/roles.errors";
import { getCmsRoles } from "@iorder/core/server/roles/roles.service";
import { denyUnless } from "@/lib/admin-access";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

export async function GET(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const denied = denyUnless(actor, "users.view", "Bạn không có quyền xem tài khoản.");
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const parsed = cmsUserListQuerySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) return fail("INVALID_INPUT", "Bộ lọc hoặc phân trang tài khoản không hợp lệ.", 400);
    const [result, roles] = await Promise.all([getCmsUsersPage(parsed.data), getCmsRoles()]);
    // Role options for the account form; assigning a role needs users.update, not roles.view.
    return NextResponse.json({ result, roles: roles.map(({ code, name, isSystem }) => ({ code, name, isSystem })) });
  } catch {
    return fail("INTERNAL_ERROR", "Không thể tải danh sách tài khoản lúc này. Vui lòng thử lại.", 500);
  }
}

export async function POST(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const body = cmsUserRequestSchema.parse(await request.json());
    const denied = denyUnless(actor, body.id ? "users.update" : "users.create", "Bạn không có quyền quản lý tài khoản.");
    if (denied) return denied;
    const id = await saveCmsUser(body.id, body.values, actor.userId);
    if (!id) return fail("NOT_FOUND", "Không tìm thấy tài khoản cần cập nhật.", 404);
    return NextResponse.json({ id });
  } catch (error: unknown) {
    if (error instanceof CmsAccessError) return fail(error.code, error.message, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra tên đăng nhập, vai trò, trạng thái và mật khẩu trước khi lưu.", 400);
    if (hasDatabaseErrorCode(error, "23505")) return fail("DUPLICATE_USER", "Tên đăng nhập hoặc email đã được sử dụng.", 409);
    return fail("INTERNAL_ERROR", "Không thể lưu tài khoản lúc này.", 500);
  }
}
