import { cleanupExpiredLoginThrottles } from "@iorder/shared/server/auth/login-throttle.repository";
import { recordJobRun } from "@iorder/shared/server/system/job-runs";
import { describeScriptError } from "./lib/script-error";

const rawLimit = process.env.AUTH_THROTTLE_CLEANUP_LIMIT;
const limit = rawLimit === undefined ? 500 : Number(rawLimit);

async function main() {
  const removed = await cleanupExpiredLoginThrottles(new Date(), limit);
  const summary = `Đã dọn ${removed} bucket quota đăng nhập hết hạn.`;
  console.log(summary);
  // Ghi lần chạy để màn Tình trạng hệ thống thấy tác vụ có chạy đều (lỗi khi ghi không làm hỏng tác vụ).
  await recordJobRun("login-throttles", { ok: true, summary });
}

void main().catch(async (error: unknown) => {
  console.error(`Không thể dọn bucket quota đăng nhập: ${describeScriptError(error, "cleanup-login-throttles")}`);
  await recordJobRun("login-throttles", { ok: false, summary: "Không thể dọn bucket quota đăng nhập." });
  process.exitCode = 1;
});
