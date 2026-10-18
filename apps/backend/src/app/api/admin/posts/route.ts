import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { createAdminPost, getAdminPostsPage, getAdminPostSummariesPage } from "@iorder/core/server/posts/posts.service";
import { publicPostTypeSchema } from "@iorder/core/server/posts/posts.contract";
import { adminListQuerySchema, listSortParams } from "@iorder/core/server/shared/admin-list.contract";
import { hasDatabaseErrorCode } from "@iorder/core/server/shared/database-error";
import { denyPublishUnless, requestedStatusOf } from "@/lib/admin-access";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

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

async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);

  const query = new URL(request.url).searchParams;
  const pagination = adminListQuerySchema.safeParse({ page: query.get("page") ?? undefined, pageSize: query.get("pageSize") ?? undefined, query: query.get("query") ?? undefined, ...listSortParams(query) });
  const status = z.enum(["draft", "review", "scheduled", "published", "archived"]).optional().safeParse(query.get("status") || undefined);
  const type = publicPostTypeSchema.optional().safeParse(query.get("type") || undefined);
  const excludeType = publicPostTypeSchema.optional().safeParse(query.get("excludeType") || undefined);
  const taxonomy = z.object({ categoryId: z.string().uuid().optional(), tagId: z.string().uuid().optional() }).safeParse({ categoryId: query.get("categoryId") || undefined, tagId: query.get("tagId") || undefined });
  if (!pagination.success || !status.success || !type.success || !excludeType.success || !taxonomy.success) return phanHoiLoi("INVALID_INPUT", "Bộ lọc danh sách bài viết không hợp lệ.", 400);
  try {
    const list = query.get("view") === "summary" ? getAdminPostSummariesPage : getAdminPostsPage;
    return NextResponse.json({ result: await list({ ...pagination.data, status: status.data, type: type.data, excludeType: excludeType.data, ...taxonomy.data }) });
  } catch {
    return phanHoiLoi("INTERNAL_ERROR", "Không thể tải danh sách bài viết lúc này. Vui lòng thử lại.", 500);
  }
}

async function handlePOST(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return phanHoiLoi("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
  }

  try {
    const denied = denyPublishUnless(administrator, "posts.publish", { requestedStatus: requestedStatusOf(body) });
    if (denied) return denied;
    const post = await createAdminPost(body, administrator.userId);
    lamMoiNoiDungBaiViet(post.slug);
    return NextResponse.json({ post }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) return phanHoiLoi("INVALID_INPUT", "Vui lòng kiểm tra lại nội dung và metadata bài viết.", 400);
    if (hasDatabaseErrorCode(error, "23505")) return phanHoiLoi("DUPLICATE_SLUG", "Slug bài viết đã tồn tại.", 409);

    logger.error("Tạo bài viết trong CMS thất bại.", { request, error });
    return phanHoiLoi("INTERNAL_ERROR", "Không thể tạo bài viết lúc này. Vui lòng thử lại.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
