import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { cmsUserListQuerySchema, cmsUserRequestSchema } from "@iorder/shared/server/users/users.contract";
import { hasDatabaseErrorCode } from "@iorder/shared/server/shared/database-error";
import { getCmsUsersPage, removeCmsUser, saveCmsUser } from "@iorder/shared/server/users/users.service";
import { CmsAccessError } from "@iorder/shared/server/roles/roles.errors";
import { getCmsRoles } from "@iorder/shared/server/roles/roles.service";
import { denyUnless } from "@/lib/admin-access";
import { withRequestContext } from "@/lib/request-context";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

async function handleGET(request: Request) {
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

async function handlePOST(request: Request) {
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

// Xóa mềm tài khoản đã khóa (?id=); repository kiểm quyền users.delete, không tự xóa mình, không xóa tài khoản quyền cao hơn.
async function handleDELETE(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const denied = denyUnless(actor, "users.delete", "Bạn không có quyền xóa tài khoản.");
  if (denied) return denied;
  try {
    const deletedId = await removeCmsUser(new URL(request.url).searchParams.get("id") ?? "", actor.userId);
    if (!deletedId) return fail("NOT_FOUND", "Không tìm thấy tài khoản cần xóa. Vui lòng tải lại danh sách.", 404);
    return NextResponse.json({ deletedId });
  } catch (error: unknown) {
    if (error instanceof CmsAccessError) return fail(error.code, error.message, error.status);
    return fail("INTERNAL_ERROR", "Không thể xóa tài khoản lúc này.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
export const DELETE = withRequestContext(handleDELETE);
