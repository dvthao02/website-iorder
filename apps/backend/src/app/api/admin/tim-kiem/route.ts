import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { searchAdminCms } from "@iorder/core/server/admin/global-search.service";

export async function GET(request: Request) {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });

  const keyword = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const items = await searchAdminCms(keyword);

  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=20" } });
}
