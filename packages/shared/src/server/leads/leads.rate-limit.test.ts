import assert from "node:assert/strict";
import test from "node:test";

import { evaluateLeadRateLimit, leadRateLimitMax, leadRateLimitMessage, leadRateLimitWindowMs } from "./leads.rate-limit";

const now = new Date("2026-11-17T05:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

test("Cửa sổ 10 phút, tối đa 5 liên hệ mỗi IP", () => {
  assert.equal(leadRateLimitWindowMs, 10 * 60 * 1000);
  assert.equal(leadRateLimitMax, 5);
});

test("Dưới mức tối đa thì cho gửi, kể cả khi đã có liên hệ trong cửa sổ", () => {
  assert.deepEqual(evaluateLeadRateLimit([], now), { allowed: true });
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(1)], now), { allowed: true });
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(1), minutesAgo(2), minutesAgo(3), minutesAgo(4)], now), { allowed: true });
});

test("Đủ mức tối đa thì chặn và báo chờ đến khi lượt cũ nhất hết hạn", () => {
  // Lượt cũ nhất cách đây 9 phút → hết hạn sau 1 phút nữa.
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(9), minutesAgo(7), minutesAgo(5), minutesAgo(3), minutesAgo(1)], now), { allowed: false, retryAfterSeconds: 60 });
  // Thứ tự đầu vào không ảnh hưởng.
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(1), minutesAgo(9), minutesAgo(5), minutesAgo(3), minutesAgo(7)], now), { allowed: false, retryAfterSeconds: 60 });
});

test("Liên hệ ngoài cửa sổ không được tính", () => {
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(20), minutesAgo(16), minutesAgo(10.5), minutesAgo(10.1), minutesAgo(2)], now), { allowed: true });
  // Còn đúng 4 lượt trong cửa sổ + vài lượt ngoài cửa sổ: vẫn cho gửi.
  assert.equal(evaluateLeadRateLimit([minutesAgo(30), minutesAgo(25), minutesAgo(4), minutesAgo(3), minutesAgo(2), minutesAgo(1)], now).allowed, true);
});

test("Nhiều hơn mức tối đa (do hạ mức): phải chờ đủ số lượt hết hạn để xuống dưới mức", () => {
  // 6 lượt, mức 5: cần 2 lượt cũ nhất hết hạn; lượt thứ hai (8 phút trước) hết hạn sau 2 phút.
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(9), minutesAgo(8), minutesAgo(6), minutesAgo(3), minutesAgo(2), minutesAgo(1)], now), { allowed: false, retryAfterSeconds: 120 });
});

test("Số giây chờ luôn ít nhất 1 và làm tròn lên", () => {
  const almostExpired = [new Date(now.getTime() - leadRateLimitWindowMs + 1), minutesAgo(4), minutesAgo(3), minutesAgo(2), minutesAgo(1)];
  assert.deepEqual(evaluateLeadRateLimit(almostExpired, now), { allowed: false, retryAfterSeconds: 1 });
});

test("Số giây chờ không bao giờ vượt quá độ dài cửa sổ, kể cả khi đồng hồ DB đi trước vài giây", () => {
  const ahead = (seconds: number) => new Date(now.getTime() + seconds * 1_000);
  assert.deepEqual(evaluateLeadRateLimit([ahead(5), ahead(6), ahead(7), ahead(8), ahead(9)], now), { allowed: false, retryAfterSeconds: 600 });
  assert.deepEqual(evaluateLeadRateLimit([minutesAgo(0), minutesAgo(0), minutesAgo(0), minutesAgo(0), minutesAgo(0)], now), { allowed: false, retryAfterSeconds: 600 });
});

test("Thông báo cho khách không nêu số: tới 1 phút thì \"vài giây\", tới 15 phút thì \"ít phút\", lâu hơn (giới hạn theo ngày) thì mời gọi hotline", () => {
  for (const seconds of [1, 30, 60]) {
    const message = leadRateLimitMessage(seconds);
    assert.match(message, /đợi vài giây/, String(seconds));
    assert.doesNotMatch(message, /\d/, String(seconds));
  }
  for (const seconds of [61, 300, 600, 900]) {
    const message = leadRateLimitMessage(seconds);
    assert.match(message, /thử lại sau ít phút\.$/, String(seconds));
    assert.doesNotMatch(message, /\d/, String(seconds));
  }
  for (const seconds of [901, 3_600, 86_400]) {
    const message = leadRateLimitMessage(seconds);
    assert.match(message, /gọi hotline/, String(seconds));
    assert.doesNotMatch(message, /\d/, String(seconds));
  }
});
