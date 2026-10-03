import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { taxonomyRequestSchema } from "@iorder/core/server/taxonomy/taxonomy.contract";
import { getTaxonomy, writeTaxonomy } from "@iorder/core/server/taxonomy/taxonomy.service";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  return NextResponse.json({ taxonomy: await getTaxonomy() });
}

export async function POST(request: Request) { const user = await getRequestAdministrator(); if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 }); try { const body = taxonomyRequestSchema.parse(await request.json()); const id = await writeTaxonomy(body.kind, body.id, body.values, user.userId); if (!id) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Không tìm thấy chuyên mục hoặc thẻ cần cập nhật." } }, { status: 404 }); revalidatePath("/tin-tuc"); revalidatePath("/tin-tuc/chuyen-muc/[slug]", "page"); revalidatePath("/tin-tuc/the/[slug]", "page"); revalidatePath("/sitemap.xml"); return NextResponse.json({ id }); } catch (error) { if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Kiểm tra tên, slug, chuyên mục cha và thứ tự hiển thị trước khi lưu." } }, { status: 400 }); if (typeof error === "object" && error && "code" in error && error.code === "23505") return NextResponse.json({ error: { code: "DUPLICATE_SLUG", message: "Slug đã được sử dụng." } }, { status: 409 }); return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu phân loại bài viết lúc này." } }, { status: 500 }); } }
