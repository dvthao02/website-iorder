import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { hasAnyCmsPermission, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { listingPageOwnerModules } from "@iorder/core/server/pages/pages.contract";
import { issuePreview } from "@iorder/core/server/publishing/preview.service";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

const requestSchema = z.object({ kind: z.enum(["post", "page", "offering"]), id: z.string().uuid() }).strict();
// Ai xem được nội dung trong CMS thì xem trước được; trang danh sách còn mở cho module sở hữu.
const viewPermissions: Record<z.infer<typeof requestSchema>["kind"], CmsPermissionCode[]> = {
  post: ["posts.view"],
  page: ["pages.view", ...listingPageOwnerModules.map((module) => `${module}.view` as CmsPermissionCode)],
  offering: ["offerings.view"],
};

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Cấp token xem trước bản nháp (1 giờ) cho đúng một nội dung.
async function handlePOST(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_INPUT", "Nội dung cần xem trước không hợp lệ.", 400);
  if (!hasAnyCmsPermission(actor, viewPermissions[parsed.data.kind])) return fail("FORBIDDEN", "Bạn không có quyền xem nội dung này.", 403);
  try {
    const preview = await issuePreview(parsed.data.kind, parsed.data.id);
    return preview ? NextResponse.json(preview) : fail("NOT_FOUND", "Không tìm thấy nội dung để xem trước.", 404);
  } catch (error) {
    logger.error("Tạo liên kết xem trước thất bại.", { request, error });
    return fail("INTERNAL_ERROR", "Không tạo được liên kết xem trước. Vui lòng thử lại.", 500);
  }
}

export const POST = withRequestContext(handlePOST);
