import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { logger } from "@iorder/shared/server/shared/logger";
import { getTranslationOverview } from "@iorder/shared/server/translations/translations.service";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

// Tổng quan bản dịch: số câu tiếng Việt cần dịch và mỗi ngôn ngữ đã dịch được bao nhiêu. Quyền: settings.view (proxy kiểm).
async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    return NextResponse.json({ overview: await getTranslationOverview() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("Không đọc được tổng quan bản dịch.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải tổng quan bản dịch lúc này." } }, { status: 500 });
  }
}

export const GET = withRequestContext(handleGET);
