import { cleanupExpiredSessions } from "@iorder/shared/server/auth/session-cleanup.repository";
import { recordJobRun } from "@iorder/shared/server/system/job-runs";

const rawLimit = process.env.SESSION_CLEANUP_LIMIT;
const limit = rawLimit === undefined ? 1_000 : Number(rawLimit);

async function main() {
  const removed = await cleanupExpiredSessions(new Date(), limit);
  const summary = `Đã dọn ${removed} phiên đăng nhập hết hạn.`;
  console.log(summary);
  // Ghi lần chạy để màn Tình trạng hệ thống thấy tác vụ có chạy đều (lỗi khi ghi không làm hỏng tác vụ).
  await recordJobRun("session-cleanup", { ok: true, summary });
}

void main().catch(async () => {
  console.error("Không thể dọn phiên đăng nhập.");
  await recordJobRun("session-cleanup", { ok: false, summary: "Không thể dọn phiên đăng nhập." });
  process.exitCode = 1;
});
