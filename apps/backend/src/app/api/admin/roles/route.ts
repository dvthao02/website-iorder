import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { cmsActionLabels, cmsModules } from "@iorder/core/server/auth/permissions";
import { cmsRoleDeleteRequestSchema, cmsRoleRequestSchema } from "@iorder/core/server/roles/roles.contract";
import { CmsAccessError } from "@iorder/core/server/roles/roles.errors";
import { getCmsRoles, removeCmsRole, saveCmsRole } from "@iorder/core/server/roles/roles.service";
import { denyUnless } from "@/lib/admin-access";

export const runtime = "nodejs";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

function mutationFailure(error: unknown, fallback: string) {
  if (error instanceof CmsAccessError) return fail(error.code, error.message, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra tên vai trò và danh sách quyền trước khi lưu.", 400);
  return fail("INTERNAL_ERROR", fallback, 500);
}

// The permission catalog travels with the roles so the CMS matrix never
// hard-codes modules or actions.
export async function GET() {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const denied = denyUnless(actor, "roles.view", "Bạn không có quyền xem vai trò.");
  if (denied) return denied;
  try {
    return NextResponse.json({ roles: await getCmsRoles(), modules: cmsModules, actionLabels: cmsActionLabels });
  } catch {
    return fail("INTERNAL_ERROR", "Không thể tải danh sách vai trò lúc này.", 500);
  }
}

export async function POST(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const body = cmsRoleRequestSchema.parse(await request.json());
    const denied = denyUnless(actor, body.id ? "roles.update" : "roles.create", "Bạn không có quyền quản lý vai trò.");
    if (denied) return denied;
    return NextResponse.json({ id: await saveCmsRole(body.id, body.values, actor.userId) }, { status: body.id ? 200 : 201 });
  } catch (error: unknown) {
    return mutationFailure(error, "Không thể lưu vai trò lúc này.");
  }
}

export async function DELETE(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const { id } = cmsRoleDeleteRequestSchema.parse(await request.json());
    return NextResponse.json({ deletedId: await removeCmsRole(id, actor.userId) });
  } catch (error: unknown) {
    return mutationFailure(error, "Không thể xóa vai trò lúc này.");
  }
}
