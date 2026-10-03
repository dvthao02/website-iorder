import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { supportDownloadMutationSchema } from "@iorder/core/server/support/support-downloads.contract";
import {
  ArchivedSupportDownloadError,
  changeSupportDownloadArchiveState,
  SupportDownloadVersionConflictError,
  updateAdminSupportDownload,
} from "@iorder/core/server/support/support-downloads.service";

export const runtime = "nodejs";

type SupportDownloadRouteProps = { params: Promise<{ id: string }> };

function phanHoiLoi(ma: string, thongBao: string, trangThai: number) {
  return NextResponse.json({ error: { code: ma, message: thongBao } }, { status: trangThai });
}

export async function PATCH(request: Request, { params }: SupportDownloadRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return phanHoiLoi("INVALID_INPUT", "Mục Hỗ trợ cần cập nhật không hợp lệ.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return phanHoiLoi("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400);
  }

  try {
    const mutation = supportDownloadMutationSchema.parse(body);
    const download = mutation.action === "save"
      ? await updateAdminSupportDownload(id, mutation.values, administrator.userId, {
          expectedVersion: mutation.expectedVersion,
          changeNote: mutation.changeNote,
        })
      : await changeSupportDownloadArchiveState(id, mutation.action === "archive", administrator.userId, mutation.expectedVersion);
    if (!download) {
      return phanHoiLoi("NOT_FOUND", "Không tìm thấy mục Hỗ trợ cần cập nhật.", 404);
    }

    revalidatePath("/ho-tro/cai-dat");
    return NextResponse.json({ download });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return phanHoiLoi("INVALID_INPUT", "Vui lòng kiểm tra lại các trường của mục Hỗ trợ.", 400);
    }
    if (error instanceof SupportDownloadVersionConflictError) return phanHoiLoi("VERSION_CONFLICT", error.message, 409);
    if (error instanceof ArchivedSupportDownloadError) return phanHoiLoi("CONTENT_ARCHIVED", error.message, 409);

    console.error("Cập nhật mục Hỗ trợ trong CMS thất bại.", error);
    return phanHoiLoi("INTERNAL_ERROR", "Không thể cập nhật mục Hỗ trợ lúc này. Vui lòng thử lại.", 500);
  }
}
