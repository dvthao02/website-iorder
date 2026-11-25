import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { logger } from "@iorder/shared/server/shared/logger";
import { ContentVersionConflictError } from "@iorder/shared/server/shared/content-version";
import { translationLocalesUpdateSchema } from "@iorder/shared/server/translations/translations.contract";
import { getTranslationOverview, TranslationLocaleInUseError, updateTranslationLocales } from "@iorder/shared/server/translations/translations.service";
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

// Thêm hoặc gỡ ngôn ngữ: { locales: ["en", "ja"], expectedVersion } (toàn bộ danh sách mong muốn, version lấy từ tổng quan). Quyền: settings.update (proxy kiểm).
// Ngôn ngữ đã có bản dịch không gỡ được (400 LOCALE_IN_USE); sai version trả 409.
async function handlePUT(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const { locales, expectedVersion } = translationLocalesUpdateSchema.parse(await request.json());
    const saved = await updateTranslationLocales(locales, administrator.userId, expectedVersion);
    return NextResponse.json({ locales: saved.codes, version: saved.version });
  } catch (error) {
    if (error instanceof ContentVersionConflictError) return NextResponse.json({ error: { code: "VERSION_CONFLICT", message: error.message } }, { status: 409 });
    if (error instanceof TranslationLocaleInUseError) return NextResponse.json({ error: { code: "LOCALE_IN_USE", message: error.message } }, { status: 400 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Danh sách ngôn ngữ không hợp lệ." } }, { status: 400 });
    logger.error("Không lưu được danh sách ngôn ngữ.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể lưu danh sách ngôn ngữ lúc này. Vui lòng thử lại." } }, { status: 500 });
  }
}

export const GET = withRequestContext(handleGET);
export const PUT = withRequestContext(handlePUT);
