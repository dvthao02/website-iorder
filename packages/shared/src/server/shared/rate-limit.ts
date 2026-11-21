/**
 * Giới hạn số request theo khóa (thường là nhóm + IP) bằng cửa sổ cố định trong bộ nhớ tiến trình.
 *
 * Dùng để chặn request dồn dập vào API trước khi chạm DB/S3. Quota nhạy cảm (đăng nhập, liên hệ) vẫn nằm ở PostgreSQL vì cần bền
 * qua lần khởi động lại; lớp này chỉ là van xả lũ nên chấp nhận được hai điểm yếu: bộ đếm về 0 khi tiến trình khởi động lại, và mỗi
 * tiến trình đếm riêng (Backend hiện chạy một container). Nếu sau này chạy nhiều bản Backend thì hạn mức thực tế nhân lên theo số bản.
 *
 * Bộ nhớ có trần (`maxEntries`): hết chỗ thì bỏ khóa cũ nhất thay vì phình mãi khi bị quét bằng nhiều IP.
 */

export type RateLimitRule = { limit: number; windowMs: number };

export type RateLimitResult =
  | { allowed: true; remaining: number }
  // firstRejection chỉ true ở lần bị từ chối đầu tiên của mỗi cửa sổ, để nơi gọi ghi log đúng một dòng thay vì ngập log khi bị tấn công.
  | { allowed: false; retryAfterSeconds: number; firstRejection: boolean };

type Entry = { count: number; resetAt: number; rejected: boolean };

export type RateLimiterOptions = {
  now?: () => number;
  maxEntries?: number;
  sweepIntervalMs?: number;
};

export function createRateLimiter({ now = Date.now, maxEntries = 20_000, sweepIntervalMs = 60_000 }: RateLimiterOptions = {}) {
  const entries = new Map<string, Entry>();
  let nextSweepAt = 0;

  function sweep(at: number) {
    for (const [key, entry] of entries) if (entry.resetAt <= at) entries.delete(key);
    nextSweepAt = at + sweepIntervalMs;
  }

  return {
    consume(key: string, rule: RateLimitRule): RateLimitResult {
      const at = now();
      if (at >= nextSweepAt) sweep(at);

      let entry = entries.get(key);
      if (!entry || entry.resetAt <= at) {
        // Map giữ thứ tự chèn nên khóa đầu tiên là khóa cũ nhất.
        if (!entry && entries.size >= maxEntries) {
          const oldest = entries.keys().next().value;
          if (oldest !== undefined) entries.delete(oldest);
        }
        entry = { count: 0, resetAt: at + rule.windowMs, rejected: false };
        entries.set(key, entry);
      }

      if (entry.count >= rule.limit) {
        const firstRejection = !entry.rejected;
        entry.rejected = true;
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - at) / 1_000)), firstRejection };
      }

      entry.count += 1;
      return { allowed: true, remaining: rule.limit - entry.count };
    },
    size: () => entries.size,
    clear: () => entries.clear(),
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

export function rateLimitMessage(retryAfterSeconds: number) {
  return retryAfterSeconds < 60
    ? `Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau ${retryAfterSeconds} giây.`
    : `Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau ${Math.ceil(retryAfterSeconds / 60)} phút.`;
}
