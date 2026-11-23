import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { searchConsolePagePathSchema } from "@iorder/shared/server/search-console/search-console.contract";
import { diagnoseSearchConsole, getSearchConsoleOverview, getSearchConsolePageQueries } from "@iorder/shared/server/search-console/search-console";
import { denyUnless } from "@/lib/admin-access";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

// Chỉ đọc số liệu tìm kiếm từ Google Search Console. Cùng quyền với màn "Kiểm tra xuất bản" (settings.view); proxy đã kiểm
// quyền theo đường dẫn, ở đây kiểm lại cho chắc. Không có tham số: tổng quan 28 ngày. ?path=/news/ten-bai: cụm khách gõ để thấy trang đó.
// ?diagnose=1: "Kiểm tra kết nối" của màn Cài đặt Google Search Console (email tài khoản dịch vụ, website nó thấy, thuộc tính, lý do chưa nối được).
// Khóa tài khoản dịch vụ chỉ nằm ở tiến trình này, không bao giờ có trong phản hồi.
async function handleGET(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const denied = denyUnless(user, "settings.view");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  if (params.get("diagnose") === "1") return NextResponse.json({ diagnosis: await diagnoseSearchConsole() });
  const path = params.get("path");
  if (path === null) return NextResponse.json({ overview: await getSearchConsoleOverview() });
  const parsed = searchConsolePagePathSchema.safeParse(path);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Đường dẫn trang không hợp lệ." } }, { status: 400 });
  return NextResponse.json({ page: await getSearchConsolePageQueries(parsed.data) });
}

export const GET = withRequestContext(handleGET);
