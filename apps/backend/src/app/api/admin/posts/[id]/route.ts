import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { updateAdminPost } from "@iorder/core/server/posts/posts.service";

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

export async function PATCH(request: Request, { params }: PostRouteProps) {
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
    const post = await updateAdminPost(id, body, administrator.userId);
    if (!post) return phanHoiLoi("NOT_FOUND", "Không tìm thấy bài viết cần cập nhật.", 404);

    lamMoiNoiDungBaiViet(post.slug);
    return NextResponse.json({ post });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) return phanHoiLoi("INVALID_INPUT", "Vui lòng kiểm tra lại nội dung và metadata bài viết.", 400);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return phanHoiLoi("DUPLICATE_SLUG", "Slug bài viết đã tồn tại.", 409);

    console.error("Cập nhật bài viết trong CMS thất bại.", error);
    return phanHoiLoi("INTERNAL_ERROR", "Không thể cập nhật bài viết lúc này. Vui lòng thử lại.", 500);
  }
}
