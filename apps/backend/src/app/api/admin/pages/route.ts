import { NextResponse } from "next/server";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { FixedWebsitePageBindingError, getAdminPagesPage, saveAdminPage } from "@iorder/core/server/pages/pages.service";
import { adminListQuerySchema } from "@iorder/core/server/shared/admin-list.contract";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { PageVersionConflictError } from "@iorder/core/server/pages/page-version";
import { pageSaveRequestSchema } from "@iorder/core/server/pages/pages.contract";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
export async function GET(request: Request) {
  if (!await getRequestAdministrator()) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const query = new URL(request.url).searchParams;
  const parsed = adminListQuerySchema.safeParse({ page: query.get("page") ?? undefined, pageSize: query.get("pageSize") ?? undefined, query: query.get("query") ?? undefined });
  const status = z.enum(["draft", "review", "scheduled", "published", "archived"]).optional().safeParse(query.get("status") || undefined);
  if (!parsed.success || !status.success) return fail("INVALID_INPUT", "Bộ lọc danh sách trang không hợp lệ.", 400);
  try {
    return NextResponse.json({ result: await getAdminPagesPage({ ...parsed.data, status: status.data }) });
  } catch {
    return fail("INTERNAL_ERROR", "Không thể tải danh sách trang lúc này. Vui lòng thử lại.", 500);
  }
}
export async function POST(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu trang không hợp lệ.", 400); }
  try {
    const { id, values, expectedVersion } = pageSaveRequestSchema.parse(body);
    const page = await saveAdminPage(id, values, user.userId, { expectedVersion });
    if (!page) return fail("NOT_FOUND", "Không tìm thấy trang cần cập nhật.", 404);
    revalidatePath("/", "layout");
    return NextResponse.json({ page }, { status: id ? 200 : 201 });
  } catch (error) {
    if (error instanceof PageVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    if (error instanceof FixedWebsitePageBindingError) return fail("FIXED_PAGE_ROUTE", error.message, 400);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra tiêu đề, slug, trạng thái, SEO và cấu trúc block trước khi lưu.", 400);
    if (hasDatabaseErrorCode(error, "23505")) return fail("DUPLICATE_SLUG", "Slug trang đã tồn tại.", 409);
    return fail("INTERNAL_ERROR", "Không thể lưu trang lúc này.", 500);
  }
}
