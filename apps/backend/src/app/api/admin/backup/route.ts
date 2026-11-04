import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getBackupOverview } from "@iorder/core/server/backup/backup-status";
import { isNightlyBackupScheduled, runLocalBackup, restoreLocalBackup, scheduleNightlyBackup, unscheduleNightlyBackup } from "@iorder/core/server/backup/local-ops";
import { logger } from "@iorder/core/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  try {
    const [backup, scheduled] = await Promise.all([getBackupOverview(), isNightlyBackupScheduled().catch(() => false)]);
    return NextResponse.json({ backup, scheduled });
  } catch (error) {
    logger.error("Không đọc được trạng thái sao lưu.", { request, error });
    return fail("INTERNAL_ERROR", "Không đọc được trạng thái sao lưu. Vui lòng thử lại.", 500);
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("run") }),
  z.object({ action: z.literal("restore"), stamp: z.string().min(1) }),
  z.object({ action: z.literal("schedule-on") }),
  z.object({ action: z.literal("schedule-off") }),
]);

// Chỉ Super Admin gọi được (admin-permission.ts: POST /api/admin/backup không map permission nào).
// "run"/"restore" chỉ chạy một cú bấm khi database đang ở localhost (local-ops.ts tự kiểm tra lại).
async function handlePOST(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_INPUT", "Yêu cầu không hợp lệ.", 400);
  const body = parsed.data;

  if (body.action === "run") {
    const result = await runLocalBackup(administrator.userId);
    return result.ok ? NextResponse.json(result) : fail("BACKUP_FAILED", result.message, 500);
  }
  if (body.action === "restore") {
    const result = await restoreLocalBackup(body.stamp, administrator.userId);
    return result.ok ? NextResponse.json(result) : fail("RESTORE_FAILED", result.message, 500);
  }
  if (body.action === "schedule-on") {
    const result = await scheduleNightlyBackup();
    return result.ok ? NextResponse.json({ scheduled: true }) : fail("SCHEDULE_FAILED", result.message, 500);
  }
  const result = await unscheduleNightlyBackup();
  return result.ok ? NextResponse.json({ scheduled: false }) : fail("SCHEDULE_FAILED", result.message, 500);
}

export const GET = withRequestContext(handleGET);
export const POST = withRequestContext(handlePOST);
