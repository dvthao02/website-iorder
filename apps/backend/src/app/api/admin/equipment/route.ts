import { NextResponse } from "next/server";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getEquipmentGroups, getEquipmentPage, writeEquipment } from "@iorder/core/server/equipment/equipment.service";
import { adminListQuerySchema, listSortParams } from "@iorder/core/server/shared/admin-list.contract";
import { equipmentWriteRequestSchema } from "@iorder/core/server/equipment/equipment.contract";
import { EquipmentVersionConflictError } from "@iorder/core/server/equipment/equipment-version";
import { ContentVersionConflictError } from "@iorder/core/server/shared/content-version";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { denyPublishUnless, denyUnless, forbiddenResponse, requestedStatusOf } from "@/lib/admin-access";
import { getEquipmentById, getEquipmentGroupVisibility } from "@iorder/core/server/equipment/equipment.service";
import { hasCmsPermission } from "@iorder/core/server/auth/permissions";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

function requestedGroupVisibility(values: unknown) {
  return values && typeof values === "object" && "isEnabled" in values && values.isEnabled === true ? "published" : "draft";
}

async function handleGET(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const query = new URL(request.url).searchParams;
    if (query.get("groupsOnly") === "1") return NextResponse.json({ equipmentGroups: await getEquipmentGroups() });
    const pagination = adminListQuerySchema.safeParse({ page: query.get("page") ?? undefined, pageSize: query.get("pageSize") ?? undefined, query: query.get("query") ?? undefined, ...listSortParams(query) });
    const status = z.enum(["draft", "review", "scheduled", "published", "archived"]).optional().safeParse(query.get("status") || undefined);
    const groupId = z.string().uuid().optional().safeParse(query.get("groupId") || undefined);
    if (!pagination.success || !status.success || !groupId.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Bộ lọc danh sách thiết bị không hợp lệ." } }, { status: 400 });
    const [result, equipmentGroups] = await Promise.all([getEquipmentPage({ ...pagination.data, status: status.data, groupId: groupId.data }), getEquipmentGroups()]);
    return NextResponse.json({ result, equipmentGroups });
  } catch (error) {
    logger.error("Tải danh sách thiết bị hoặc nhóm trong CMS thất bại.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải danh sách thiết bị hoặc nhóm lúc này. Vui lòng thử lại." } }, { status: 500 });
  }
}

async function handlePOST(request: Request) {
  const user = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const body = equipmentWriteRequestSchema.parse(await request.json());
    // An enabled group exposes all of its equipment, so groups follow the same
    // publish rule as items: showing a group or editing a visible one needs publish.
    const denied = denyUnless(user, body.id ? "equipment.update" : "equipment.create")
      ?? (body.kind === "items"
        ? denyPublishUnless(user, "equipment.publish", { requestedStatus: requestedStatusOf(body.values), currentStatus: body.id ? (await getEquipmentById(body.id))?.status : null })
        : denyPublishUnless(user, "equipment.publish", { requestedStatus: requestedGroupVisibility(body.values), currentStatus: body.id && await getEquipmentGroupVisibility(body.id) ? "published" : null }));
    if (denied) return denied;
    const onlyIfHidden = body.kind === "groups" && !hasCmsPermission(user, "equipment.publish");
    const id = await writeEquipment(body.kind, body.id, body.values, user.userId, undefined, body.expectedVersion, { onlyIfHidden });
    if (!id && body.id && onlyIfHidden) return forbiddenResponse("Bạn không có quyền sửa nhóm thiết bị đang hiển thị trên website.");
    if (!id) return fail("NOT_FOUND", "Không tìm thấy thiết bị hoặc nhóm.", 404);
    revalidatePath("/thiet-bi", "layout");
    return NextResponse.json({ id, ...(body.kind === "items" ? { version: body.id ? body.expectedVersion! + 1 : 1 } : {}) });
  } catch (error) {
    if (error instanceof EquipmentVersionConflictError || error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra nhóm, tên, slug, giá, ảnh và cấu trúc thông số trước khi lưu.", 400);
    if (hasDatabaseErrorCode(error, "23505")) return fail("DUPLICATE_SLUG", "Slug đã được sử dụng. Vui lòng chọn slug khác.", 409);
    return fail("INTERNAL_ERROR", "Không thể lưu thiết bị hoặc nhóm lúc này.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
