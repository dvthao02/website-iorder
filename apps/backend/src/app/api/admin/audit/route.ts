import { NextResponse } from "next/server";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { auditListQuerySchema } from "@iorder/core/server/audit/audit.contract";
import { getAuditActors, getAuditLogsPage } from "@iorder/core/server/audit/audit.service";
import { withRequestContext } from "@/lib/request-context";

async function handleGET(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  const query = auditListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Bộ lọc nhật ký không hợp lệ." } }, { status: 400 });
  try {
    const [result, actors] = await Promise.all([getAuditLogsPage(query.data), getAuditActors()]);
    return NextResponse.json({ result, actors });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không tải được nhật ký. Vui lòng thử lại." } }, { status: 500 });
  }
}

export const GET = withRequestContext(handleGET);
