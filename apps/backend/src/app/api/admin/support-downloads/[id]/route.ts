import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { supportDownloadMutationSchema } from "@iorder/core/server/support/support-downloads.contract";
import { denyPublishUnless } from "@/lib/admin-access";
import { getAdminSupportDownloadById } from "@iorder/core/server/support/support-downloads.service";
import {
  ArchivedSupportDownloadError,
  changeSupportDownloadArchiveState,
  deleteArchivedAdminSupportDownload,
  SupportDownloadVersionConflictError,
  updateAdminSupportDownload,
} from "@iorder/core/server/support/support-downloads.service";
import { logger } from "@iorder/core/server/shared/logger";

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
    const denied = denyPublishUnless(administrator, "support_downloads.publish", mutation.action === "save"
      ? { requestedStatus: mutation.values.isEnabled ? "published" : "draft", currentStatus: (await getAdminSupportDownloadById(id))?.status }
      : { stateAction: mutation.action });
    if (denied) return denied;
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

    logger.error("Cập nhật mục Hỗ trợ trong CMS thất bại.", { request, error });
    return phanHoiLoi("INTERNAL_ERROR", "Không thể cập nhật mục Hỗ trợ lúc này. Vui lòng thử lại.", 500);
  }
}

export async function DELETE(request: Request, { params }: SupportDownloadRouteProps) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return phanHoiLoi("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return phanHoiLoi("INVALID_INPUT", "Mục Hỗ trợ cần xóa không hợp lệ.", 400);
  const version = new URL(request.url).searchParams.get("version");
  const expectedVersion = version === null ? Number.NaN : Number(version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) return phanHoiLoi("INVALID_INPUT", "Vui lòng tải lại để lấy phiên bản tài nguyên mới nhất trước khi xóa.", 400);

  try {
    const deletedId = await deleteArchivedAdminSupportDownload(id, administrator.userId, expectedVersion);
    if (!deletedId) return phanHoiLoi("NOT_FOUND", "Chỉ có thể xóa tài nguyên đang lưu trữ.", 404);
    revalidatePath("/ho-tro/cai-dat");
    return NextResponse.json({ deletedId });
  } catch (error) {
    if (error instanceof SupportDownloadVersionConflictError) return phanHoiLoi("VERSION_CONFLICT", error.message, 409);
    logger.error("Xóa tài nguyên Hỗ trợ trong CMS thất bại.", { request, error });
    return phanHoiLoi("INTERNAL_ERROR", "Không thể xóa tài nguyên lúc này. Vui lòng thử lại.", 500);
  }
}
