import { NextResponse } from "next/server";
import { z } from "zod";

import { hasCmsPermission } from "@iorder/shared/server/auth/permissions";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { authorRequestSchema } from "@iorder/shared/server/authors/authors.contract";
import { AuthorLiveEditForbiddenError } from "@iorder/shared/server/authors/authors.repository";
import { getAdminAuthors, getAuthorVisibility, removeAuthor, writeAuthor } from "@iorder/shared/server/authors/authors.service";
import { hasDatabaseErrorCode } from "@iorder/shared/server/shared/database-error";
import { ContentVersionConflictError } from "@iorder/shared/server/shared/content-version";
import { logger } from "@iorder/shared/server/shared/logger";
import { denyPublishUnless, denyUnless, forbiddenResponse } from "@/lib/admin-access";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { withRequestContext } from "@/lib/request-context";

// Tác giả thuộc mô-đun Bài viết nên dùng quyền posts.*: xem danh sách cần posts.view, tạo/sửa/xóa cần posts.create/update/delete.
// Bật trang công khai của tác giả (isEnabled) hay sửa tác giả đang bật cần thêm posts.publish, như mọi nội dung đang hiển thị.

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

function requestedVisibility(values: unknown) {
  return values && typeof values === "object" && "isEnabled" in values && (values as { isEnabled?: unknown }).isEnabled === true ? "published" : "draft";
}

// Đổi tác giả đổi cả dòng "Tác giả" trên bài và trang riêng của họ.
function revalidateAuthorPages() {
  revalidatePath("/tac-gia/[slug]", "page");
  revalidatePath("/tin-tuc/[slug]", "page");
  revalidatePath("/ho-tro/huong-dan/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

async function handleGET() {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  return NextResponse.json({ authors: await getAdminAuthors() });
}

async function handlePOST(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  try {
    const body = authorRequestSchema.parse(await request.json());
    const denied = denyUnless(user, body.id ? "posts.update" : "posts.create")
      ?? denyPublishUnless(user, "posts.publish", { requestedStatus: requestedVisibility(body.values), currentStatus: body.id && await getAuthorVisibility(body.id) ? "published" : null });
    if (denied) return denied;
    const onlyIfHidden = !hasCmsPermission(user, "posts.publish");
    const id = await writeAuthor(body.id, body.values, user.userId, { expectedVersion: body.expectedVersion, onlyIfHidden });
    if (!id) return fail("NOT_FOUND", "Không tìm thấy tác giả cần cập nhật.", 404);
    revalidateAuthorPages();
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof AuthorLiveEditForbiddenError) return forbiddenResponse(error.message);
    if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
    // Lỗi có thông báo riêng (ví dụ ảnh đại diện không hợp lệ) được trả nguyên văn; còn lại nhắc các trường hay sai.
    if (error instanceof z.ZodError) return fail("INVALID_INPUT", error.issues.find((issue) => issue.code === "custom")?.message ?? "Kiểm tra tên, đường dẫn, ảnh đại diện và địa chỉ trang cá nhân trước khi lưu.", 400);
    if (error instanceof SyntaxError) return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
    if (hasDatabaseErrorCode(error, "23505")) return fail("DUPLICATE_SLUG", "Đường dẫn này đã được tác giả khác dùng.", 409);
    logger.error("Lưu tác giả trong CMS thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể lưu tác giả lúc này.", 500);
  }
}

async function handleDELETE(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: new URL(request.url).searchParams.get("id") });
  if (!parsed.success) return fail("INVALID_INPUT", "Mã tác giả không hợp lệ.", 400);
  // Xóa tác giả đang hiển thị trang riêng cũng cần quyền xuất bản.
  const denied = denyUnless(user, "posts.delete") ?? denyPublishUnless(user, "posts.publish", { currentStatus: await getAuthorVisibility(parsed.data.id) ? "published" : null });
  if (denied) return denied;
  try {
    const result = await removeAuthor(parsed.data.id, user.userId);
    if (!result) return fail("NOT_FOUND", "Không tìm thấy tác giả cần xóa.", 404);
    if ("blockedBy" in result) return fail("AUTHOR_IN_USE", `Còn ${result.postCount} bài dùng tác giả này. Đổi tác giả của các bài đó trước khi xóa.`, 409);
    revalidateAuthorPages();
    return NextResponse.json({ deletedId: result.id });
  } catch (error) {
    logger.error("Xóa tác giả trong CMS thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không thể xóa tác giả lúc này.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
export const DELETE = withRequestContext(handleDELETE);
