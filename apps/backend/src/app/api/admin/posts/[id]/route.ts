import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { NextResponse } from "next/server";
import { adminDetailResponse } from "../../../../../lib/admin-detail-response";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { contentDeleteRequestSchema, contentStateRequestSchema, contentUpdateRequestSchema, ContentVersionConflictError } from "@iorder/core/server/shared/content-version";
import { changeAdminPostState, deleteArchivedAdminPost, getAdminPostById, updateAdminPost } from "@iorder/core/server/posts/posts.service";
import { denyPublishUnless, requestedStatusOf } from "@/lib/admin-access";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

type PostRouteProps = { params: Promise<{ id: string }> };

function phanHoiLoi(ma: string, thongBao: string, trangThai: number) {
  return NextResponse.json({ error: { code: ma, message: thongBao } }, { status: trangThai });
}

function lamMoiNoiDungBaiViet(slug: string) {
  revalidatePath("/tin-tuc");
  revalidatePath("/ho-tro/cai-dat");
  revalidatePath(`/tin-tuc/${slug}`);
  revalidatePath(`/ho-tro/cai-dat/${slug}`);
  revalidatePath("/tin-tuc/[slug]", "page");
  revalidatePath("/ho-tro/cai-dat/[slug]", "page");
  revalidatePath("/tin-tuc/chuyen-muc/[slug]", "page");
  revalidatePath("/tin-tuc/the/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

async function handleGET(_: Request, { params }: PostRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return phanHoiLoi("INVALID_INPUT", "Bài viết cần xem không hợp lệ.", 400);
  return adminDetailResponse("post", () => getAdminPostById(id), { missing: "Không tìm thấy bài viết.", failed: "Không thể tải bài viết lúc này. Vui lòng thử lại." });
}

async function handlePATCH(request: Request, { params }: PostRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return phanHoiLoi("INVALID_INPUT", "Bài viết cần cập nhật không hợp lệ.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return phanHoiLoi("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
  }

  try {
    if (body && typeof body === "object" && "action" in body) {
      const { action, expectedVersion } = contentStateRequestSchema.parse(body);
      const denied = denyPublishUnless(administrator, "posts.publish", { stateAction: action });
      if (denied) return denied;
      const post = await changeAdminPostState(id, action, administrator.userId, expectedVersion);
      if (!post) return phanHoiLoi("NOT_FOUND", "Không tìm thấy bài viết cần cập nhật.", 404);
      lamMoiNoiDungBaiViet(post.slug);
      return NextResponse.json({ post });
    }
    const { expectedVersion, ...values } = contentUpdateRequestSchema.parse(body);
    const denied = denyPublishUnless(administrator, "posts.publish", { requestedStatus: requestedStatusOf(values), currentStatus: (await getAdminPostById(id))?.status });
    if (denied) return denied;
    const post = await updateAdminPost(id, values, administrator.userId, undefined, expectedVersion);
    if (!post) return phanHoiLoi("NOT_FOUND", "Không tìm thấy bài viết cần cập nhật.", 404);

    lamMoiNoiDungBaiViet(post.slug);
    return NextResponse.json({ post });
  } catch (error: unknown) {
    if (error instanceof ContentVersionConflictError) return phanHoiLoi("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError) return phanHoiLoi("INVALID_INPUT", "Vui lòng kiểm tra lại nội dung và metadata bài viết.", 400);
    if (hasDatabaseErrorCode(error, "23505")) return phanHoiLoi("DUPLICATE_SLUG", "Slug bài viết đã tồn tại.", 409);

    logger.error("Cập nhật bài viết trong CMS thất bại.", { request, error });
    return phanHoiLoi("INTERNAL_ERROR", "Không thể cập nhật bài viết lúc này. Vui lòng thử lại.", 500);
  }
}

async function handleDELETE(request: Request, { params }: PostRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return phanHoiLoi("INVALID_INPUT", "Bài viết cần xóa không hợp lệ.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return phanHoiLoi("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
  }
  try {
    const { expectedVersion } = contentDeleteRequestSchema.parse(body);
    const deleted = await deleteArchivedAdminPost(id, administrator.userId, expectedVersion);
    if (!deleted) return phanHoiLoi("NOT_FOUND", "Chỉ có thể xóa bài viết đang lưu trữ.", 404);
    lamMoiNoiDungBaiViet(deleted.slug);
    return NextResponse.json({ deletedId: deleted.id });
  } catch (error: unknown) {
    if (error instanceof ContentVersionConflictError) return phanHoiLoi("VERSION_CONFLICT", error.message, 409);
    if (error instanceof z.ZodError) return phanHoiLoi("INVALID_INPUT", "Phiên bản nội dung cần xóa không hợp lệ. Vui lòng tải lại danh sách.", 400);
    return phanHoiLoi("INTERNAL_ERROR", "Không thể xóa bài viết lúc này. Vui lòng thử lại.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const PATCH = withRequestContext(handlePATCH);
export const DELETE = withRequestContext(handleDELETE);
