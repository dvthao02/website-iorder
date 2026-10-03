import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getEquipment, getEquipmentGroups, writeEquipment } from "@iorder/core/server/equipment/equipment.service";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const [equipment, equipmentGroups] = await Promise.all([getEquipment(), getEquipmentGroups()]);
  return NextResponse.json({ equipment, equipmentGroups });
}

export async function POST(request: Request) {
  const user = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const body = z.object({ kind: z.enum(["groups", "items"]), id: z.string().uuid().nullable(), values: z.unknown() }).strict().parse(await request.json());
    const id = await writeEquipment(body.kind, body.id, body.values, user.userId);
    if (!id) return fail("NOT_FOUND", "Không tìm thấy thiết bị hoặc nhóm.", 404);
    revalidatePath("/thiet-bi", "layout");
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra nhóm, tên, slug, giá, ảnh và cấu trúc thông số trước khi lưu.", 400);
    const cause = error instanceof Error && "cause" in error ? error.cause : error;
    if (typeof cause === "object" && cause && "code" in cause && cause.code === "23505") return fail("DUPLICATE_SLUG", "Slug đã được sử dụng. Vui lòng chọn slug khác.", 409);
    return fail("INTERNAL_ERROR", "Không thể lưu thiết bị hoặc nhóm lúc này.", 500);
  }
}
