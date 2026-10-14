import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { redirectRequestSchema } from "@iorder/core/server/redirects/redirects.contract";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { deleteAdminRedirect, getRedirects, writeRedirect } from "@iorder/core/server/redirects/redirects.service";

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
    const id = await writeRedirect(body.id, body.values, user.userId);
    if (!id) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy chuyển hướng cần cập nhật." } }, { status: 404 });
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Kiểm tra đường dẫn nguồn, đích và mã chuyển hướng trước khi lưu." } }, { status: 400 });
    if (hasDatabaseErrorCode(error, "23505")) return NextResponse.json({ error: { code: "DUPLICATE_SOURCE", message: "Đường dẫn nguồn đã có trong danh sách chuyển hướng." } }, { status: 409 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu chuyển hướng lúc này." } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Mã chuyển hướng không hợp lệ." } }, { status: 400 });
  const deletedId = await deleteAdminRedirect(parsedId.data, user.userId);
  if (!deletedId) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy chuyển hướng cần xóa." } }, { status: 404 });
  return NextResponse.json({ deletedId });
}
