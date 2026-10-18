import { NextResponse } from "next/server";
import { ContentVersionConflictError, expectedVersionSchema } from "@iorder/core/server/shared/content-version";
import { z } from "zod";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { partnerListQuerySchema, testimonialListQuerySchema } from "@iorder/core/server/supporting/supporting.contract";
import { deleteDisabledSupporting, getPartnersPage, getSupportingVisibility, getTestimonialsPage, writeSupporting } from "@iorder/core/server/supporting/supporting.service";
import { denyPublishUnless, denyUnless, forbiddenResponse } from "@/lib/admin-access";
import { hasCmsPermission } from "@iorder/core/server/auth/permissions";
import { withRequestContext } from "@/lib/request-context";

async function handleGET(request: Request) {
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

async function handlePOST(request: Request) {
  const user = await getRequestAdministrator(); const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try { const body = z.object({ kind: z.enum(["partners", "testimonials"]), id: z.string().uuid().nullable(), values: z.unknown(), expectedVersion: expectedVersionSchema.optional() }).strict().refine((value) => !value.id || value.expectedVersion !== undefined, { path: ["expectedVersion"], message: "Vui lòng tải lại để lấy phiên bản trước khi lưu." }).parse(await request.json()); const requestedEnabled = body.values && typeof body.values === "object" && "isEnabled" in body.values ? body.values.isEnabled === true : false; const currentEnabled = body.id ? await getSupportingVisibility(body.kind, body.id) : undefined; const denied = denyUnless(user, body.id ? "supporting.update" : "supporting.create") ?? denyPublishUnless(user, "supporting.publish", { requestedStatus: requestedEnabled ? "published" : "draft", currentStatus: currentEnabled ? "published" : null }); if (denied) return denied; const mayPublish = hasCmsPermission(user, "supporting.publish"); const id = await writeSupporting(body.kind, body.id, body.values, user.userId, { onlyIfHidden: !mayPublish, expectedVersion: body.expectedVersion }); if (!id && body.id && !mayPublish) return forbiddenResponse("Bạn không có quyền sửa nội dung đang hiển thị trên website."); if (!id) return fail("NOT_FOUND", "Không tìm thấy nội dung cần cập nhật.", 404); revalidatePath("/", "layout"); return NextResponse.json({ id }); }
  catch (error) { if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409); if (error instanceof z.ZodError || error instanceof SyntaxError) return fail("INVALID_INPUT", "Kiểm tra tên, nội dung, ảnh và thứ tự hiển thị trước khi lưu.", 400); if (hasDatabaseErrorCode(error, "23505")) return fail("DUPLICATE_NAME", "Tên đối tác đã tồn tại.", 409); return fail("INTERNAL_ERROR", "Không thể lưu nội dung lúc này.", 500); }
}

async function handleDELETE(request: Request) {
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

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
export const DELETE = withRequestContext(handleDELETE);
