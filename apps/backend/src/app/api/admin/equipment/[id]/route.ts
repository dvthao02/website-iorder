import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { deleteAdminEquipmentGroup, deleteArchivedAdminEquipment, getEquipmentById } from "@iorder/core/server/equipment/equipment.service";
import { EquipmentVersionConflictError } from "@iorder/core/server/equipment/equipment-version";
import { changeAdminEquipmentState } from "@iorder/core/server/equipment/equipment.service";
import { contentStateRequestSchema, ContentVersionConflictError } from "@iorder/core/server/shared/content-version";
import { denyPublishUnless } from "@/lib/admin-access";
import { withRequestContext } from "@/lib/request-context";

type EquipmentRouteProps = { params: Promise<{ id: string }> };

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function handlePATCH(request: Request, { params }: EquipmentRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Thiết bị cần cập nhật không hợp lệ.", 400);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400); }
  try {
    const { action, expectedVersion } = contentStateRequestSchema.parse(body);
    const denied = denyPublishUnless(administrator, "equipment.publish", { stateAction: action });
    if (denied) return denied;
    const equipment = await changeAdminEquipmentState(id, action, administrator.userId, expectedVersion);
    if (!equipment) return fail("NOT_FOUND", "Không tìm thấy thiết bị cần cập nhật.", 404);
    revalidatePath("/thiet-bi", "layout");
    return NextResponse.json({ equipment });
  } catch (error) {
    if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError) return fail("INVALID_INPUT", "Thao tác hoặc phiên bản thiết bị không hợp lệ. Vui lòng tải lại danh sách.", 400);
    return fail("INTERNAL_ERROR", "Không thể cập nhật trạng thái thiết bị lúc này.", 500);
  }
}

async function handleDELETE(request: Request, { params }: EquipmentRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("INVALID_INPUT", "Thiết bị cần xóa không hợp lệ.", 400);

  const kind = z.enum(["items", "groups"]).optional().safeParse(new URL(request.url).searchParams.get("kind") ?? undefined);
  if (!kind.success) return fail("INVALID_INPUT", "Loại dữ liệu thiết bị không hợp lệ.", 400);
  if (kind.data === "groups") {
    const deleted = await deleteAdminEquipmentGroup(id, administrator.userId);
    if (deleted && "blockedBy" in deleted) return fail("GROUP_IN_USE", "Không thể xóa nhóm khi vẫn còn thiết bị. Hãy chuyển hoặc xóa các thiết bị trong nhóm trước.", 409);
    if (!deleted) return fail("NOT_FOUND", "Không tìm thấy nhóm thiết bị cần xóa.", 404);
    revalidatePath("/thiet-bi", "layout");
    return NextResponse.json({ deletedId: deleted.id });
  }

  const expectedVersion = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).safeParse(new URL(request.url).searchParams.get("expectedVersion") ?? undefined);
  if (!expectedVersion.success) return fail("INVALID_INPUT", "Vui lòng tải lại danh sách để lấy phiên bản thiết bị mới nhất trước khi xóa.", 400);
  let deleted;
  try {
    deleted = await deleteArchivedAdminEquipment(id, administrator.userId, expectedVersion.data);
  } catch (error) {
    if (error instanceof EquipmentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    return fail("INTERNAL_ERROR", "Không thể xóa thiết bị lúc này.", 500);
  }
  if (!deleted) return fail("NOT_FOUND", "Chỉ có thể xóa thiết bị đang lưu trữ.", 404);
  revalidatePath("/thiet-bi", "layout");
  return NextResponse.json({ deletedId: deleted.id });
}

async function handleGET(_: Request, { params }: EquipmentRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  const equipment = await getEquipmentById(id);
  return equipment ? NextResponse.json({ equipment }) : fail("NOT_FOUND", "Không tìm thấy thiết bị.", 404);
}

export const PATCH = withRequestContext(handlePATCH);
export const DELETE = withRequestContext(handleDELETE);
export const GET = withRequestContext(handleGET);
