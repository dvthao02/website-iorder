import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { FixedWebsitePageBindingError, getAdminPages, saveAdminPage } from "@iorder/core/server/pages/pages.service";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
export async function GET() {
  if (!await getRequestAdministrator()) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  return NextResponse.json({ pages: await getAdminPages() });
}
export async function POST(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu trang không hợp lệ.", 400); }
  try {
    const { id, values } = z.object({ id: z.string().uuid().nullable(), values: z.unknown() }).strict().parse(body);
    const page = await saveAdminPage(id, values, user.userId);
    if (!page) return fail("NOT_FOUND", "Không tìm thấy trang cần cập nhật.", 404);
    revalidatePath("/", "layout");
    return NextResponse.json({ page }, { status: id ? 200 : 201 });
  } catch (error) {
    if (error instanceof FixedWebsitePageBindingError) return fail("FIXED_PAGE_ROUTE", error.message, 400);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra tiêu đề, slug, trạng thái, SEO và cấu trúc block trước khi lưu.", 400);
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return fail("DUPLICATE_SLUG", "Slug trang đã tồn tại.", 409);
    return fail("INTERNAL_ERROR", "Không thể lưu trang lúc này.", 500);
  }
}
