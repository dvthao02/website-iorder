import assert from "node:assert/strict";
import test from "node:test";

import { evaluateLeadRateLimit, leadRateLimitMax, leadRateLimitMessage, leadRateLimitWindowMs } from "./leads.rate-limit";

const now = new Date("2026-11-17T05:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

test("Cửa sổ 15 phút, tối đa 3 liên hệ mỗi IP", () => {
  assert.equal(leadRateLimitWindowMs, 15 * 60 * 1000);
  assert.equal(leadRateLimitMax, 3);
});

test("Dưới mức tối đa thì cho gửi, kể cả khi đã có liên hệ trong cửa sổ", () => {
  assert.deepEqual(evaluateLeadRateLimit([], now), { allowed: true });
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(1)], now), { allowed: true });
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(1), minutesAgo(2)], now), { allowed: true });
});

test("Đủ mức tối đa thì chặn và báo chờ đến khi lượt cũ nhất hết hạn", () => {
  // Lượt cũ nhất cách đây 10 phút → hết hạn sau 5 phút nữa.
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(10), minutesAgo(5), minutesAgo(1)], now), { allowed: false, retryAfterSeconds: 300 });
  // Thứ tự đầu vào không ảnh hưởng.
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(1), minutesAgo(10), minutesAgo(5)], now), { allowed: false, retryAfterSeconds: 300 });
});

test("Liên hệ ngoài cửa sổ không được tính", () => {
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(20), minutesAgo(16), minutesAgo(15.5), minutesAgo(2)], now), { allowed: true });
  // Còn đúng 2 lượt trong cửa sổ + 1 lượt ngoài cửa sổ: vẫn cho gửi.
  assert.equal(evaluateLeadRateLimit([minutesAgo(30), minutesAgo(3), minutesAgo(1)], now).allowed, true);
});

test("Nhiều hơn mức tối đa (do hạ mức): phải chờ đủ số lượt hết hạn để xuống dưới mức", () => {
  // 4 lượt, mức 3: cần 2 lượt cũ nhất hết hạn; lượt thứ hai (10 phút trước) hết hạn sau 5 phút.
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(14), minutesAgo(10), minutesAgo(5), minutesAgo(1)], now), { allowed: false, retryAfterSeconds: 300 });
});

test("Số giây chờ luôn ít nhất 1 và làm tròn lên", () => {
  const almostExpired = [new Date(now.getTime() - leadRateLimitWindowMs + 1), minutesAgo(2), minutesAgo(1)];
  assert.deepEqual(evaluateLeadRateLimit(almostExpired, now), { allowed: false, retryAfterSeconds: 1 });
});

test("Số giây chờ không bao giờ vượt quá độ dài cửa sổ, kể cả khi đồng hồ DB đi trước vài giây", () => {
  const ahead = (seconds: number) => new Date(now.getTime() + seconds * 1_000);
  assert.deepEqual(evaluateLeadRateLimit([ahead(5), ahead(6), ahead(7)], now), { allowed: false, retryAfterSeconds: 900 });
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(0), minutesAgo(0), minutesAgo(0)], now), { allowed: false, retryAfterSeconds: 900 });
});

test("Thông báo cho khách nói rõ số phút chờ (làm tròn lên, tối thiểu 1)", () => {
  assert.match(leadRateLimitMessage(300), /thử lại sau 5 phút\.$/);
  assert.match(leadRateLimitMessage(61), /thử lại sau 2 phút\.$/);
  assert.match(leadRateLimitMessage(1), /thử lại sau 1 phút\.$/);
  assert.match(leadRateLimitMessage(900), /thử lại sau 15 phút\.$/);
});
