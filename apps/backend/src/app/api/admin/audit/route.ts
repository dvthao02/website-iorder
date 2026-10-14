import { NextResponse } from "next/server";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { auditListQuerySchema } from "@iorder/core/server/audit/audit.contract";
import { getAuditLogsPage } from "@iorder/core/server/audit/audit.service";

export async function GET(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const query = auditListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Bộ lọc nhật ký không hợp lệ." } }, { status: 400 });
  try {
    return NextResponse.json({ result: await getAuditLogsPage(query.data) });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không tải được nhật ký. Vui lòng thử lại." } }, { status: 500 });
  }
}
