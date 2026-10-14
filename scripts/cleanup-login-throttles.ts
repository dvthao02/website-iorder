import { cleanupExpiredLoginThrottles } from "@iorder/core/server/auth/login-throttle.repository";

const rawLimit = process.env.AUTH_THROTTLE_CLEANUP_LIMIT;
const limit = rawLimit === undefined ? 500 : Number(rawLimit);

async function main() {
  const removed = await cleanupExpiredLoginThrottles(new Date(), limit);
  console.log(`Đã dọn ${removed} bucket quota đăng nhập hết hạn.`);
}

void main().catch(() => {
  console.error("Không thể dọn bucket quota đăng nhập.");
  process.exitCode = 1;
});
