// Giới hạn gửi liên hệ từ website, tính theo IP đã băm: tối đa `leadRateLimitMax` liên hệ trong mỗi cửa sổ `leadRateLimitWindowMs`.
// Nhiều người cùng văn phòng và mạng di động dùng chung IP, khách gõ sai rồi gửi lại, một người hỏi mua vài thiết bị liền nhau: 5 liên hệ
// mỗi 10 phút (trước là 3 mỗi 15 phút) để khách thật hiếm khi chạm giới hạn và chạm thì chờ tối đa 10 phút; vẫn đủ chặn spam hàng loạt.
// Giữ nguyên là chống spam, không phải xác thực.
export const leadRateLimitWindowMs = 10 * 60 * 1000;
export const leadRateLimitMax = 5;

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

/** Chờ tới 1 phút thì nói "vài giây"; tới ngần này giây thì nói "ít phút"; lâu hơn (giới hạn theo ngày) thì mời gọi hotline thay vì hẹn một con số. */
const leadSecondsWaitSeconds = 60;
const leadShortWaitSeconds = 15 * 60;

/** Thông báo cho khách, không nêu số phút cụ thể (số giây chính xác nằm ở header Retry-After). */
export function leadRateLimitMessage(retryAfterSeconds: number) {
  if (retryAfterSeconds <= leadSecondsWaitSeconds) return "Bạn gửi hơi nhanh. Vui lòng đợi vài giây rồi gửi lại.";
  return retryAfterSeconds <= leadShortWaitSeconds
    ? "Bạn đã gửi liên hệ nhiều lần trong thời gian ngắn. Vui lòng thử lại sau ít phút."
    : "Bạn đã gửi liên hệ nhiều lần. Vui lòng thử lại sau hoặc gọi hotline để được hỗ trợ ngay.";
}
