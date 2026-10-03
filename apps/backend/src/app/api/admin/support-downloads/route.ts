import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { supportDownloadCreateRequestSchema } from "@iorder/core/server/support/support-downloads.contract";
import { createAdminSupportDownload, getAdminSupportDownloads } from "@iorder/core/server/support/support-downloads.service";

export async function GET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  return NextResponse.json({ downloads: await getAdminSupportDownloads() });
}

export async function POST(request: Request) {
  const user = await getRequestAdministrator();
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  if (!user) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400); }
  try {
    const { values, changeNote } = supportDownloadCreateRequestSchema.parse(body);
    const download = await createAdminSupportDownload(values, user.userId, changeNote);
    revalidatePath("/ho-tro/cai-dat");
    return NextResponse.json({ download }, { status: 201 });
  } catch (error) {
    return error instanceof z.ZodError ? fail("INVALID_INPUT", "Kiểm tra tiêu đề, thông tin và tệp liên kết trước khi lưu.", 400)
      : fail("INTERNAL_ERROR", "Không thể tạo mục tải xuống.", 500);
  }
}
