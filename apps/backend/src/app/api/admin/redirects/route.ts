import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { redirectRequestSchema } from "@iorder/core/server/redirects/redirects.contract";
import { getRedirects, writeRedirect } from "@iorder/core/server/redirects/redirects.service";

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
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return NextResponse.json({ error: { code: "DUPLICATE_SOURCE", message: "Đường dẫn nguồn đã có trong danh sách chuyển hướng." } }, { status: 409 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu chuyển hướng lúc này." } }, { status: 500 });
  }
}
