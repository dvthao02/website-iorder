import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getExternalLinks, updateExternalLinks } from "@iorder/core/server/settings/external-links.service";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  return NextResponse.json({ links: await getExternalLinks() });
}

export async function PUT(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const links = await updateExternalLinks(await request.json(), user.userId);
    revalidatePath("/", "layout");
    return NextResponse.json({ links });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Kiểm tra các URL liên kết ngoài trước khi lưu." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu liên kết ngoài lúc này." } }, { status: 500 });
  }
}
