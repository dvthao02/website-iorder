import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { redirectRequestSchema } from "@iorder/core/server/redirects/redirects.contract";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { deleteAdminRedirect, getRedirects, writeRedirect } from "@iorder/core/server/redirects/redirects.service";
import { denyUnless } from "@/lib/admin-access";
import { ContentVersionConflictError } from "@iorder/core/server/shared/content-version";
import { revalidatePath } from "@/lib/publish-cache-revalidation";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  return NextResponse.json({ redirects: await getRedirects() });
}

export async function POST(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const body = redirectRequestSchema.parse(await request.json());
    const denied = denyUnless(user, body.id ? "redirects.update" : "redirects.create");
    if (denied) return denied;
    const id = await writeRedirect(body.id, body.values, user.userId, body.expectedVersion);
    if (!id) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy chuyển hướng cần cập nhật." } }, { status: 404 });
    // publish-web caches each path's redirect lookup (including "none") under the public tag.
    revalidatePath("/", "layout");
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof ContentVersionConflictError) return NextResponse.json({ error: { code: "VERSION_CONFLICT", message: error.message } }, { status: 409 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Kiểm tra đường dẫn nguồn, đích và mã chuyển hướng trước khi lưu." } }, { status: 400 });
    if (hasDatabaseErrorCode(error, "23505")) return NextResponse.json({ error: { code: "DUPLICATE_SOURCE", message: "Đường dẫn nguồn đã có trong danh sách chuyển hướng." } }, { status: 409 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu chuyển hướng lúc này." } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const parsedId = z.string().uuid().safeParse(query.get("id"));
  if (!parsedId.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Mã chuyển hướng không hợp lệ." } }, { status: 400 });
  // Bắt buộc version: tab cũ không được xóa chuyển hướng vừa bị người khác sửa.
  const expectedVersion = z.coerce.number().int().nonnegative().safeParse(query.get("expectedVersion") ?? undefined);
  if (!expectedVersion.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Vui lòng tải lại danh sách để lấy phiên bản mới nhất trước khi xóa." } }, { status: 400 });
  let deletedId: string | undefined;
  try {
    deletedId = await deleteAdminRedirect(parsedId.data, user.userId, expectedVersion.data);
  } catch (error) {
    if (error instanceof ContentVersionConflictError) return NextResponse.json({ error: { code: "VERSION_CONFLICT", message: error.message } }, { status: 409 });
    throw error;
  }
  if (!deletedId) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy chuyển hướng cần xóa." } }, { status: 404 });
  revalidatePath("/", "layout");
  return NextResponse.json({ deletedId });
}
