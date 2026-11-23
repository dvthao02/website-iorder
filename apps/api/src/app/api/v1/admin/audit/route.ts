import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { auditListQuerySchema } from "@iorder/shared/server/audit/audit.contract";
import { getAuditActors, getAuditLogsPage, purgeAuditLogs } from "@iorder/shared/server/audit/audit.service";
import { logger } from "@iorder/shared/server/shared/logger";
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

// Dọn nhật ký: chỉ Super Admin (module audit chỉ có quyền view nên POST không map permission nào, xem admin-permission.ts).
// Body: { mode: "selected" | "filtered" | "older_than" | "all", ..., dryRun? } (xem auditPurgeRequestSchema).
async function handlePOST(request: Request) {
  const actor = await getRequestAdministrator();
  if (!actor) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    const result = await purgeAuditLogs(await request.json().catch(() => null), actor.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Yêu cầu dọn nhật ký không hợp lệ." } }, { status: 400 });
    logger.error("Không dọn được nhật ký hoạt động.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không dọn được nhật ký. Vui lòng thử lại." } }, { status: 500 });
  }
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
