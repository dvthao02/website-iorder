import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getLeads } from "@iorder/core/server/leads/leads.service";

export const runtime = "nodejs";

export async function GET() {
  const administrator = await getRequestAdministrator();
  if (!administrator) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." } }, { status: 401 });
  }

  return NextResponse.json({ leads: await getLeads() });
}
