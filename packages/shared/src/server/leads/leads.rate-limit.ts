// Giới hạn gửi liên hệ từ website, tính theo IP đã băm: tối đa `leadRateLimitMax` liên hệ trong mỗi cửa sổ `leadRateLimitWindowMs`.
// 1 liên hệ/15 phút (mức cũ) chặn nhầm khách gõ sai rồi gửi lại, nhiều người cùng văn phòng và mạng di động dùng chung IP;
// 3 liên hệ vẫn đủ chặn spam hàng loạt. Giữ nguyên là chống spam, không phải xác thực.
export const leadRateLimitWindowMs = 15 * 60 * 1000;
export const leadRateLimitMax = 3;

export type LeadRateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Cho gửi tiếp hay không, dựa trên thời điểm các liên hệ gần đây của cùng IP. Bị chặn thì trả số giây phải chờ:
 * đến lúc lượt gửi cũ nhất còn đè cửa sổ hết hạn và số lượt trong cửa sổ xuống dưới mức tối đa.
 */
export function evaluateLeadRateLimit(recent: readonly Date[], now: Date, windowMs = leadRateLimitWindowMs, max = leadRateLimitMax): LeadRateLimitDecision {
  const inWindow = recent.map((date) => date.getTime()).filter((time) => time >= now.getTime() - windowMs).sort((a, b) => a - b);
  if (inWindow.length < max) return { allowed: true };
  const releasesAt = inWindow[inWindow.length - max] + windowMs;
  // Chặn trần bằng độ dài cửa sổ: đồng hồ máy chủ ứng dụng và cơ sở dữ liệu lệch nhau vài giây (thời điểm lưu lead lấy từ DB)
  // không được làm số giây chờ vượt quá cửa sổ, vì không lượt gửi nào bị tính quá một cửa sổ.
  return { allowed: false, retryAfterSeconds: Math.min(Math.ceil(windowMs / 1000), Math.max(1, Math.ceil((releasesAt - now.getTime()) / 1000))) };
}

/** Thông báo cho khách, nói rõ chờ bao lâu (làm tròn lên phút) thay vì "chờ ít phút". */
export function leadRateLimitMessage(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Bạn đã gửi liên hệ nhiều lần trong thời gian ngắn. Vui lòng thử lại sau ${minutes} phút.`;
}
