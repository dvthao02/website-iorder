import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getBackupOverview } from "@iorder/core/server/backup/backup-status";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

// Trang "Sao lưu & phục hồi" chỉ đọc: script sao lưu chạy trên máy chủ ghi kết quả, CMS không chạy hay phục hồi gì.
async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  }
  try {
    return NextResponse.json({ backup: await getBackupOverview() });
  } catch (error) {
    logger.error("Không đọc được trạng thái sao lưu.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không đọc được trạng thái sao lưu. Vui lòng thử lại." } }, { status: 500 });
  }
}

export const GET = withRequestContext(handleGET);
