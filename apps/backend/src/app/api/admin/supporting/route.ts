import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getPartners, getTestimonials, writeSupporting } from "@iorder/core/server/supporting/supporting.service";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const [partners, testimonials] = await Promise.all([getPartners(), getTestimonials()]);
  return NextResponse.json({ partners, testimonials });
}

export async function POST(request: Request) {
  const user = await getRequestAdministrator(); const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try { const body = z.object({ kind: z.enum(["partners", "testimonials"]), id: z.string().uuid().nullable(), values: z.unknown() }).strict().parse(await request.json()); const id = await writeSupporting(body.kind, body.id, body.values, user.userId); if (!id) return fail("NOT_FOUND", "Không tìm thấy nội dung cần cập nhật.", 404); revalidatePath("/", "layout"); return NextResponse.json({ id }); }
  catch (error) { if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra tên, nội dung, ảnh và thứ tự hiển thị trước khi lưu.", 400); if (typeof error === "object" && error && "code" in error && error.code === "23505") return fail("DUPLICATE_NAME", "Tên đối tác đã tồn tại.", 409); return fail("INTERNAL_ERROR", "Không thể lưu nội dung lúc này.", 500); }
}
