import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getCatalogContent, updateCatalogContent } from "@iorder/core/server/settings/catalog-content.service";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  return NextResponse.json({ content: await getCatalogContent() });
}
export async function PUT(request: Request) { const user = await getRequestAdministrator(); if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 }); try { const content = await updateCatalogContent(await request.json(), user.userId); revalidatePath("/", "layout"); return NextResponse.json({ content }); } catch (error) { if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Kiểm tra tiêu đề, nhãn và mô tả của từng trang catalog trước khi lưu." } }, { status: 400 }); return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu nội dung catalog lúc này." } }, { status: 500 }); } }
