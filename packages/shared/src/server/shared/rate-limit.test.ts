import assert from "node:assert/strict";
import test from "node:test";

import { createRateLimiter, rateLimitMessage } from "./rate-limit";

const rule = { limit: 3, windowMs: 10_000 };

function clock(start = 1_000_000) {
  let value = start;
  return { now: () => value, advance: (ms: number) => { value += ms; } };
}

test("Cho qua đủ hạn mức rồi từ chối kèm số giây chờ", () => {
  const time = clock();
  const limiter = createRateLimiter({ now: time.now });

  assert.deepEqual(limiter.consume("ip:1", rule), { allowed: true, remaining: 2 });
  assert.deepEqual(limiter.consume("ip:1", rule), { allowed: true, remaining: 1 });
  assert.deepEqual(limiter.consume("ip:1", rule), { allowed: true, remaining: 0 });

  time.advance(4_000);
  assert.deepEqual(limiter.consume("ip:1", rule), { allowed: false, retryAfterSeconds: 6, firstRejection: true });
});

test("Chỉ báo firstRejection ở lần từ chối đầu tiên của mỗi cửa sổ", () => {
  const time = clock();
  const limiter = createRateLimiter({ now: time.now });
  for (let i = 0; i < rule.limit; i += 1) limiter.consume("ip:1", rule);

  const first = limiter.consume("ip:1", rule);
  const second = limiter.consume("ip:1", rule);
  assert.equal(first.allowed === false && first.firstRejection, true);
  assert.equal(second.allowed === false && second.firstRejection, false);

  time.advance(rule.windowMs);
  for (let i = 0; i < rule.limit; i += 1) limiter.consume("ip:1", rule);
  const nextWindow = limiter.consume("ip:1", rule);
  assert.equal(nextWindow.allowed === false && nextWindow.firstRejection, true);
});

test("Hết cửa sổ thì đếm lại từ đầu", () => {
  const time = clock();
  const limiter = createRateLimiter({ now: time.now });
  for (let i = 0; i < rule.limit; i += 1) limiter.consume("ip:1", rule);
  assert.equal(limiter.consume("ip:1", rule).allowed, false);

  time.advance(rule.windowMs);
  assert.deepEqual(limiter.consume("ip:1", rule), { allowed: true, remaining: 2 });
});

test("Mỗi khóa đếm riêng", () => {
  const limiter = createRateLimiter({ now: clock().now });
  for (let i = 0; i < rule.limit; i += 1) limiter.consume("lead:1.1.1.1", rule);

  assert.equal(limiter.consume("lead:1.1.1.1", rule).allowed, false);
  assert.equal(limiter.consume("lead:2.2.2.2", rule).allowed, true);
  assert.equal(limiter.consume("admin:1.1.1.1", rule).allowed, true);
});

test("Số giây chờ luôn tối thiểu 1 và làm tròn lên", () => {
  const time = clock();
  const limiter = createRateLimiter({ now: time.now });
  for (let i = 0; i < rule.limit; i += 1) limiter.consume("ip:1", rule);

  time.advance(9_999);
  const result = limiter.consume("ip:1", rule);
  assert.equal(result.allowed === false && result.retryAfterSeconds, 1);
});

test("Bộ nhớ có trần: đầy thì bỏ khóa cũ nhất, khóa mới vẫn được đếm", () => {
  const limiter = createRateLimiter({ now: clock().now, maxEntries: 3 });
  for (const key of ["a", "b", "c", "d", "e"]) limiter.consume(key, rule);

  assert.equal(limiter.size(), 3);
  // "a" đã bị bỏ nên bắt đầu lại từ đầu thay vì nhớ lần đếm cũ.
  assert.deepEqual(limiter.consume("a", rule), { allowed: true, remaining: 2 });
});

test("Dọn khóa hết hạn định kỳ để bộ nhớ không đầy dần", () => {
  const time = clock();
  const limiter = createRateLimiter({ now: time.now, sweepIntervalMs: 30_000 });
  for (let i = 0; i < 50; i += 1) limiter.consume(`ip:${i}`, rule);
  assert.equal(limiter.size(), 50);

  time.advance(rule.windowMs + 30_000);
  limiter.consume("ip:new", rule);
  assert.equal(limiter.size(), 1);
});

test("Thông báo nêu giây hoặc phút chờ", () => {
  assert.equal(rateLimitMessage(7), "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau 7 giây.");
  assert.equal(rateLimitMessage(61), "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau 2 phút.");
});
