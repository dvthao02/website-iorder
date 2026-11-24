import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { adminNotificationActionSchema } from "@iorder/shared/server/dashboard/notifications.contract";
import { changeNotificationStates, getAdminNotifications } from "@iorder/shared/server/dashboard/notifications.service";
import { logger } from "@iorder/shared/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store" };

// Gọi ở mỗi lần điều hướng CMS và mỗi phút (chuông thông báo); service tự lọc theo quyền và áp trạng thái đã đọc/đã xóa của người xem.
async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    return NextResponse.json({ notifications: await getAdminNotifications(administrator) }, { headers: noStore });
  } catch (error) {
    logger.error("Tải thông báo CMS thất bại.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải thông báo lúc này." } }, { status: 500 });
  }
}

// Đọc, bỏ đọc hoặc xóa thông báo của chính người xem (đọc hết, xóa hết cũng vậy). Chỉ đổi trạng thái riêng của người này, trả danh sách mới.
async function handlePOST(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  const parsed = adminNotificationActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Thao tác thông báo không hợp lệ." } }, { status: 400 });
  try {
    return NextResponse.json({ notifications: await changeNotificationStates(administrator, parsed.data) }, { headers: noStore });
  } catch (error) {
    logger.error("Cập nhật thông báo CMS thất bại.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể cập nhật thông báo lúc này." } }, { status: 500 });
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
