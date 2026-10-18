import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getAdminNotifications } from "@iorder/core/server/dashboard/notifications.service";

export const runtime = "nodejs";

// Gọi ở mỗi lần điều hướng CMS (chuông thông báo); service tự lọc theo quyền.
export async function GET() {
  const administrator = await getRequestAdministrator();
  if (!administrator) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    return NextResponse.json({ notifications: await getAdminNotifications(administrator) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Tải thông báo CMS thất bại.", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải thông báo lúc này." } }, { status: 500 });
  }
}
