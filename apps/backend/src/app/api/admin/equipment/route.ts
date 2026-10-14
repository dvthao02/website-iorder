import { NextResponse } from "next/server";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getEquipmentGroups, getEquipmentPage, writeEquipment } from "@iorder/core/server/equipment/equipment.service";
import { adminListQuerySchema } from "@iorder/core/server/shared/admin-list.contract";
import { equipmentWriteRequestSchema } from "@iorder/core/server/equipment/equipment.contract";
import { EquipmentVersionConflictError } from "@iorder/core/server/equipment/equipment-version";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";

export async function GET(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const query = new URL(request.url).searchParams;
    if (query.get("groupsOnly") === "1") return NextResponse.json({ equipmentGroups: await getEquipmentGroups() });
    const pagination = adminListQuerySchema.safeParse({ page: query.get("page") ?? undefined, pageSize: query.get("pageSize") ?? undefined, query: query.get("query") ?? undefined });
    const status = z.enum(["draft", "review", "scheduled", "published", "archived"]).optional().safeParse(query.get("status") || undefined);
    const groupId = z.string().uuid().optional().safeParse(query.get("groupId") || undefined);
    if (!pagination.success || !status.success || !groupId.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Bộ lọc danh sách thiết bị không hợp lệ." } }, { status: 400 });
    const [result, equipmentGroups] = await Promise.all([getEquipmentPage({ ...pagination.data, status: status.data, groupId: groupId.data }), getEquipmentGroups()]);
    return NextResponse.json({ result, equipmentGroups });
  } catch {
    console.error("Tải danh sách thiết bị hoặc nhóm trong CMS thất bại.");
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải danh sách thiết bị hoặc nhóm lúc này. Vui lòng thử lại." } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const body = equipmentWriteRequestSchema.parse(await request.json());
    const id = await writeEquipment(body.kind, body.id, body.values, user.userId, undefined, body.expectedVersion);
    if (!id) return fail("NOT_FOUND", "Không tìm thấy thiết bị hoặc nhóm.", 404);
    revalidatePath("/thiet-bi", "layout");
    return NextResponse.json({ id, ...(body.kind === "items" ? { version: body.id ? body.expectedVersion! + 1 : 1 } : {}) });
  } catch (error) {
    if (error instanceof EquipmentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra nhóm, tên, slug, giá, ảnh và cấu trúc thông số trước khi lưu.", 400);
    if (hasDatabaseErrorCode(error, "23505")) return fail("DUPLICATE_SLUG", "Slug đã được sử dụng. Vui lòng chọn slug khác.", 409);
    return fail("INTERNAL_ERROR", "Không thể lưu thiết bị hoặc nhóm lúc này.", 500);
  }
}
