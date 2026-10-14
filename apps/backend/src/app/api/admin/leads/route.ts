import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getLeadsPage } from "@iorder/core/server/leads/leads.service";
import { leadListQuerySchema } from "@iorder/core/server/leads/leads.contract";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const parsed = leadListQuerySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Bộ lọc liên hệ không hợp lệ." } }, { status: 400 });
  try {
    return NextResponse.json({ result: await getLeadsPage(parsed.data) });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải danh sách liên hệ. Vui lòng thử lại." } }, { status: 500 });
  }
}
