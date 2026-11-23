import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { backupKeepSchema, updateBackupKeep } from "@iorder/shared/server/backup/backup-retention";
import { backupStampSchema, clearBackupHistory, getBackupOverview } from "@iorder/shared/server/backup/backup-status";
import { deleteLocalBackup, isNightlyBackupScheduled, listLocalBackups, runLocalBackup, restoreLocalBackup, scheduleNightlyBackup, unscheduleNightlyBackup } from "@iorder/shared/server/backup/local-ops";
import { ContentVersionConflictError, expectedVersionSchema } from "@iorder/shared/server/shared/content-version";
import { logger } from "@iorder/shared/server/shared/logger";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

async function handleGET(request: Request) {
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  try {
    // local: các bản sao lưu đang nằm trên đĩa máy này (null khi database không chạy cục bộ, CMS ẩn mục tương ứng).
    const [backup, scheduled, local] = await Promise.all([getBackupOverview(), isNightlyBackupScheduled().catch(() => false), listLocalBackups()]);
    return NextResponse.json({ backup, scheduled, local });
  } catch (error) {
    logger.error("Không đọc được trạng thái sao lưu.", { request, error });
    return fail("INTERNAL_ERROR", "Không đọc được trạng thái sao lưu. Vui lòng thử lại.", 500);
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("run") }),
  z.object({ action: z.literal("restore"), stamp: backupStampSchema }),
  z.object({ action: z.literal("delete"), stamp: backupStampSchema }),
  z.object({ action: z.literal("clear-history") }),
  z.object({ action: z.literal("set-keep"), keep: backupKeepSchema, expectedVersion: expectedVersionSchema }),
  z.object({ action: z.literal("schedule-on") }),
  z.object({ action: z.literal("schedule-off") }),
]);

// Chỉ Super Admin gọi được (admin-permission.ts: POST /api/v1/admin/backup không map permission nào).
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
  if (body.action === "delete") {
    const result = await deleteLocalBackup(body.stamp, administrator.userId);
    return result.ok ? NextResponse.json({ deleted: body.stamp }) : fail(result.refused ? "DELETE_REFUSED" : "DELETE_FAILED", result.message, result.refused ? 409 : 500);
  }
  if (body.action === "clear-history") {
    try {
      return NextResponse.json({ cleared: await clearBackupHistory(administrator.userId) });
    } catch (error) {
      logger.error("Không xóa được lịch sử sao lưu.", { request, error });
      return fail("INTERNAL_ERROR", "Không xóa được lịch sử sao lưu. Vui lòng thử lại.", 500);
    }
  }
  if (body.action === "set-keep") {
    try {
      return NextResponse.json(await updateBackupKeep(body.keep, administrator.userId, body.expectedVersion));
    } catch (error) {
      if (error instanceof ContentVersionConflictError) return fail("VERSION_CONFLICT", error.message, 409);
      logger.error("Không lưu được số bản sao lưu giữ lại.", { request, error });
      return fail("INTERNAL_ERROR", "Không lưu được số bản giữ lại. Vui lòng thử lại.", 500);
    }
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
