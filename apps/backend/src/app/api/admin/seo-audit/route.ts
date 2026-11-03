import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getSeoAudit } from "@iorder/core/server/seo-audit/seo-audit.service";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  }
  try {
    return NextResponse.json({ audit: await getSeoAudit(administrator) });
  } catch (error) {
    logger.error("Kiểm tra SEO toàn website thất bại.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể kiểm tra SEO lúc này. Vui lòng thử lại." } }, { status: 500 });
  }
}

export const GET = withRequestContext(handleGET);
