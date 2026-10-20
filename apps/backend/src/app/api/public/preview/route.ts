import { NextResponse } from "next/server";

import { resolvePreview } from "@iorder/core/server/publishing/preview.service";
import { logger } from "@iorder/core/server/shared/logger";

export const runtime = "nodejs";

// Website kiểm token xem trước trước khi bật chế độ bản nháp. Không phân biệt lý do lỗi để tránh dò token.
export async function GET(request: Request) {
  try {
    const preview = await resolvePreview(new URL(request.url).searchParams.get("token"));
    if (!preview) return NextResponse.json({ error: { code: "INVALID_PREVIEW", message: "Liên kết xem trước không hợp lệ hoặc đã hết hạn." } }, { status: 404, headers: { "cache-control": "no-store" } });
    return NextResponse.json({ preview: { kind: preview.kind, path: preview.path, exp: preview.exp } }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("Kiểm tra liên kết xem trước thất bại.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không kiểm tra được liên kết xem trước." } }, { status: 500 });
  }
}
