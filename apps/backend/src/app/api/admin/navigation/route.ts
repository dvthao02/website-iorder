import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { navigationLocationSchema, navigationRequestSchema } from "@iorder/core/server/navigation/navigation.contract";
import { getAdminNavigation, NavigationVersionConflictError, saveNavigation } from "@iorder/core/server/navigation/navigation.service";

export async function GET(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const location = navigationLocationSchema.safeParse(new URL(request.url).searchParams.get("location") ?? "header");
  if (!location.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Vị trí menu không hợp lệ." } }, { status: 400 });
  return NextResponse.json({ menu: await getAdminNavigation(location.data) });
}

export async function PUT(request: Request) {
  const user = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu menu không hợp lệ.", 400); }
  try {
    const { location, version, items, changeNote } = navigationRequestSchema.parse(body);
    const menu = await saveNavigation(location, items, user.userId, { expectedVersion: version, changeNote });
    revalidatePath("/", "layout");
    return NextResponse.json({ menu });
  } catch (error) {
    if (error instanceof z.ZodError) return fail("INVALID_INPUT", "Kiểm tra mã mục, mục cha, nhãn và đường dẫn. Mục cha phải đứng trước mục con.", 400);
    if (error instanceof NavigationVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    return fail("INTERNAL_ERROR", "Không thể lưu menu.", 500);
  }
}
