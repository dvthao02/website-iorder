import { NextResponse } from "next/server";
import { readBuilderPreview } from "@iorder/core/server/publishing/builder-preview.service";
import { logger } from "@iorder/core/server/shared/logger";

export async function GET(request: Request) {
  const headers = { "cache-control": "private, no-store", "referrer-policy": "no-referrer", "x-robots-tag": "noindex, nofollow" };
  try {
    const preview = await readBuilderPreview(new URL(request.url).searchParams.get("token"));
    return preview ? NextResponse.json({ preview: { id: preview.id, documentId: preview.documentId, document: preview.document, parentOrigin: preview.parentOrigin, path: preview.path, expiresAt: preview.expiresAt } }, { headers }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "Bản xem trước không tồn tại hoặc đã hết hạn." } }, { status: 404, headers });
  } catch (error) {
    logger.error("Không đọc được bản xem trước.", { error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không tải được bản xem trước. Vui lòng thử lại." } }, { status: 500, headers });
  }
}
