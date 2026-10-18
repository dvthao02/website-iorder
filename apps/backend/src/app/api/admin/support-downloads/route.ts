import { NextResponse } from "next/server";
import { revalidatePath } from "@/lib/publish-cache-revalidation";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { supportDownloadCreateRequestSchema } from "@iorder/core/server/support/support-downloads.contract";
import { createAdminSupportDownload, getAdminSupportDownloads } from "@iorder/core/server/support/support-downloads.service";
import { denyPublishUnless } from "@/lib/admin-access";
import { withRequestContext } from "@/lib/request-context";

async function handleGET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    return NextResponse.json({ downloads: await getAdminSupportDownloads() });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải danh sách tài nguyên lúc này. Vui lòng thử lại." } }, { status: 500 });
  }
}

async function handlePOST(request: Request) {
  const user = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400); }
  try {
    const { values, changeNote } = supportDownloadCreateRequestSchema.parse(body);
    const denied = denyPublishUnless(user, "support_downloads.publish", { requestedStatus: values.isEnabled ? "published" : "draft" });
    if (denied) return denied;
    const download = await createAdminSupportDownload(values, user.userId, changeNote);
    revalidatePath("/ho-tro/cai-dat");
    return NextResponse.json({ download }, { status: 201 });
  } catch (error) {
    return error instanceof z.ZodError ? fail("INVALID_INPUT", "Kiểm tra tiêu đề, thông tin và tệp liên kết trước khi lưu.", 400)
      : fail("INTERNAL_ERROR", "Không thể tạo mục tải xuống.", 500);
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
