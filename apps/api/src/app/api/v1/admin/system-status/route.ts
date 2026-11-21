import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { logger } from "@iorder/shared/server/shared/logger";
import { getSystemStatus } from "@iorder/shared/server/system/system-status";
import { denyUnless } from "@/lib/admin-access";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tình trạng hệ thống cho người vận hành (database, kho tệp, website, sao lưu, tác vụ định kỳ, tài nguyên máy chủ, cấu hình đã đặt hay chưa).
// Quyền system.view (proxy kiểm theo đường dẫn, ở đây kiểm lại cho chắc). Chỉ đọc; phản hồi không chứa giá trị biến môi trường,
// chuỗi kết nối hay khóa. Kết quả được nhớ vài giây nên nhiều người mở cùng lúc không gọi dồn.
async function handleGET(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const denied = denyUnless(user, "system.view");
  if (denied) return denied;
  try {
    return NextResponse.json({ status: await getSystemStatus() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("Không dựng được tình trạng hệ thống.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không đọc được tình trạng hệ thống. Vui lòng thử lại." } }, { status: 500 });
  }
}

export const GET = withRequestContext(handleGET);
