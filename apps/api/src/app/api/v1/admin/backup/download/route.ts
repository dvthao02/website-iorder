import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { isSuperAdmin } from "@iorder/shared/server/auth/permissions";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { backupStampSchema } from "@iorder/shared/server/backup/backup-status";
import { prepareBackupDownload } from "@iorder/shared/server/backup/local-ops";
import { forbiddenResponse } from "@/lib/admin-access";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

// Bản sao lưu chứa toàn bộ dữ liệu (kể cả mã băm mật khẩu và giá trị cấu hình đã mã hóa): chỉ Super Admin tải được.
// Quyền xem (system.view) đã được proxy kiểm tra cho mọi GET /api/v1/admin/backup/*, nên phải kiểm lại ở đây.
async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  if (!isSuperAdmin(administrator)) return forbiddenResponse("Chỉ Super Admin tải được bản sao lưu.");
  const stamp = backupStampSchema.safeParse(new URL(request.url).searchParams.get("stamp"));
  if (!stamp.success) return fail("INVALID_INPUT", "Tên bản sao lưu không hợp lệ.", 400);

  const download = await prepareBackupDownload(stamp.data, administrator.userId);
  if (!download.ok) return fail(download.refused ? "DOWNLOAD_REFUSED" : "DOWNLOAD_FAILED", download.message, download.refused ? 409 : 500);
  return new NextResponse(Readable.toWeb(download.stream()) as ReadableStream, { headers: {
    "content-type": "application/zip",
    "content-length": String(download.size),
    "content-disposition": `attachment; filename="${download.fileName}"`,
    "cache-control": "no-store",
  } });
}

export const GET = withRequestContext(handleGET);
