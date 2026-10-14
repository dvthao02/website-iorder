import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { partnerListQuerySchema, testimonialListQuerySchema } from "@iorder/core/server/supporting/supporting.contract";
import { deleteDisabledSupporting, getPartnersPage, getTestimonialsPage, writeSupporting } from "@iorder/core/server/supporting/supporting.service";

export async function GET(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const query = new URL(request.url).searchParams;
      const kind = z.enum(["partners", "testimonials"]).safeParse(query.get("kind") ?? "partners");
      if (!kind.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Loại nội dung không hợp lệ." } }, { status: 400 });
      const input = Object.fromEntries(query);
      delete input.kind;
      const parsed = (kind.data === "partners" ? partnerListQuerySchema : testimonialListQuerySchema).safeParse(input);
      if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Bộ lọc hoặc phân trang không hợp lệ." } }, { status: 400 });
      const result = kind.data === "partners" ? await getPartnersPage(parsed.data) : await getTestimonialsPage(parsed.data);
      return NextResponse.json({ kind: kind.data, result });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải đối tác và đánh giá lúc này. Vui lòng thử lại." } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getRequestAdministrator(); const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try { const body = z.object({ kind: z.enum(["partners", "testimonials"]), id: z.string().uuid().nullable(), values: z.unknown() }).strict().parse(await request.json()); const id = await writeSupporting(body.kind, body.id, body.values, user.userId); if (!id) return fail("NOT_FOUND", "Không tìm thấy nội dung cần cập nhật.", 404); revalidatePath("/", "layout"); return NextResponse.json({ id }); }
  catch (error) { if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra tên, nội dung, ảnh và thứ tự hiển thị trước khi lưu.", 400); if (hasDatabaseErrorCode(error, "23505")) return fail("DUPLICATE_NAME", "Tên đối tác đã tồn tại.", 409); return fail("INTERNAL_ERROR", "Không thể lưu nội dung lúc này.", 500); }
}

export async function DELETE(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  const query = new URL(request.url).searchParams;
  const parsed = z.object({ kind: z.enum(["partners", "testimonials"]), id: z.string().uuid() }).safeParse({ kind: query.get("kind"), id: query.get("id") });
  if (!parsed.success) return fail("INVALID_INPUT", "Loại hoặc mã nội dung thương hiệu không hợp lệ.", 400);
  try {
    const deletedId = await deleteDisabledSupporting(parsed.data.kind, parsed.data.id, user.userId);
    if (!deletedId) return fail("CONTENT_ACTIVE", "Không tìm thấy nội dung đang ẩn để xóa. Vui lòng tải lại danh sách.", 409);
    revalidatePath("/", "layout");
    return NextResponse.json({ deletedId });
  } catch {
    return fail("INTERNAL_ERROR", "Không thể hoàn tất yêu cầu xóa lúc này. Vui lòng tải lại danh sách để kiểm tra trước khi thử lại.", 500);
  }
}
