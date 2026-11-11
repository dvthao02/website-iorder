import { getEquipmentById } from "@iorder/core/server/equipment/equipment.service";
import { NextResponse } from "next/server";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { hasAnyCmsPermission, hasCmsPermission } from "@iorder/core/server/auth/permissions";
import { getAdminPageById } from "@iorder/core/server/pages/pages.service";
import { getAdminOfferingById } from "@iorder/core/server/offerings/offerings.service";
import { getFixedWebsitePage, pagePermissionCodes } from "@iorder/core/server/pages/pages.contract";
import { builderPreviewRequestSchema } from "@iorder/core/server/publishing/builder-preview.contract";
import { saveBuilderPreview } from "@iorder/core/server/publishing/builder-preview.service";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
async function handlePOST(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const body = await request.text();
  if (Buffer.byteLength(body) > 2 * 1024 * 1024) return fail("PAYLOAD_TOO_LARGE", "Nội dung xem trước vượt quá 2 MB.", 413);
  let input: unknown;
  try { input = JSON.parse(body); } catch { return fail("INVALID_INPUT", "Nội dung xem trước không hợp lệ.", 400); }
  const parsed = builderPreviewRequestSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", "Hoàn thiện thông tin được yêu cầu trước khi xem trước.", 400);
  const data = parsed.data;
  if (request.headers.get("origin") !== data.parentOrigin) return fail("FORBIDDEN", "Nguồn xem trước không khớp CMS.", 403);
  try {
    if (data.document.kind === "page") {
      const existing = data.documentId ? await getAdminPageById(data.documentId) : undefined;
      if (data.documentId && !existing) return fail("NOT_FOUND", "Không tìm thấy trang.", 404);
      if (!hasAnyCmsPermission(actor, existing ? pagePermissionCodes(existing.slug, "view") : ["pages.create"])) return fail("FORBIDDEN", "Bạn không có quyền xem trước trang này.", 403);
      const fixed = getFixedWebsitePage(existing?.slug ?? data.document.values.slug);
      const targetFixed = getFixedWebsitePage(data.document.values.slug);
      if ((targetFixed && existing?.slug !== targetFixed.slug) || (fixed && (!existing || fixed.slug !== data.document.values.slug || fixed.template !== data.document.values.template))) return fail("INVALID_INPUT", "Không thể đổi ràng buộc trang hệ thống trong bản xem trước.", 400);
    } else if (data.document.kind === "equipment") {
      const existing = data.documentId ? await getEquipmentById(data.documentId) : undefined;
      if (data.documentId && !existing) return fail("NOT_FOUND", "Không tìm thấy thiết bị.", 404);
      if (!hasCmsPermission(actor, existing ? "equipment.view" : "equipment.create")) return fail("FORBIDDEN", "Bạn không có quyền xem trước thiết bị này.", 403);
    } else {
      const existing = data.documentId ? await getAdminOfferingById(data.documentId) : undefined;
      if (data.documentId && !existing) return fail("NOT_FOUND", "Không tìm thấy nội dung catalog.", 404);
      if (!hasCmsPermission(actor, existing ? "offerings.view" : "offerings.create")) return fail("FORBIDDEN", "Bạn không có quyền xem trước nội dung này.", 403);
    }
    const preview = await saveBuilderPreview(actor.userId, data);
    return preview ? NextResponse.json(preview, { headers: { "cache-control": "private, no-store" } }) : fail("STALE_PREVIEW", "Bản xem trước đã có thay đổi mới hơn. Hãy thử lại.", 409);
  } catch (error) {
    logger.error("Cập nhật bản xem trước thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không cập nhật được bản xem trước. Vui lòng thử lại.", 500);
  }
}
export const POST = withRequestContext(handlePOST);
