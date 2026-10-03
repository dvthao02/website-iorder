import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getPublishingConfig, updatePublishingConfig } from "@iorder/core/server/settings/publishing.service";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  return NextResponse.json({ config: await getPublishingConfig() });
}

export async function PUT(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const config = await updatePublishingConfig(await request.json(), user.userId);
    revalidatePath("/", "layout");
    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Kiểm tra URL website, tiêu đề, mô tả và ảnh chia sẻ trước khi lưu." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu cấu hình xuất bản lúc này." } }, { status: 500 });
  }
}
