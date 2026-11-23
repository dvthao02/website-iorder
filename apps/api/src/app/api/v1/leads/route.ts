import { NextResponse } from "next/server";
import { z } from "zod";
import { leadRateLimitMessage } from "@iorder/shared/server/leads/leads.rate-limit";
import { newLeadToken, submitPublicLead } from "@iorder/shared/server/leads/leads.service";
import { logger } from "@iorder/shared/server/shared/logger";
import { getClientAddress } from "@/lib/client-address";
function clientAddress(request: Request) { return getClientAddress(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip")); }

// Biểu mẫu website xin mã phiên khi hiện ra rồi gửi kèm khi bấm Gửi (leads.guard.ts). Không lưu gì ở máy chủ: mã tự ký và ghi giờ cấp.
export async function GET() {
  return NextResponse.json({ token: newLeadToken() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Dữ liệu liên hệ không hợp lệ." } }, { status: 400 }); }
  try {
    const result = await submitPublicLead(input, clientAddress(request));
    if (!result.accepted && result.kind === "same_device") {
      // Một số điện thoại chỉ hỏi mua một thiết bị một lần mỗi ngày: nói rõ để khách biết yêu cầu trước đã được ghi nhận, không phải lỗi gửi.
      logger.warn("Liên hệ bị từ chối vì đã hỏi mua thiết bị này.", { request });
      return NextResponse.json({ error: { code: "LEAD_SAME_DEVICE", message: "Bạn đã gửi yêu cầu cho thiết bị này rồi, iOrder sẽ liên hệ sớm. Cần bổ sung thông tin, vui lòng gọi hotline." } }, { status: 409 });
    }
    if (!result.accepted && result.kind === "rate_limited") {
      logger.warn("Liên hệ bị giới hạn tần suất.", { request, scope: result.scope });
      const response = NextResponse.json({ error: { code: "RATE_LIMITED", message: leadRateLimitMessage(result.retryAfterSeconds) } }, { status: 429 });
      response.headers.set("retry-after", String(result.retryAfterSeconds));
      return response;
    }
    if (!result.accepted) {
      // Mã phiên thiếu/sai/quá hạn/chưa đủ tuổi. Biểu mẫu website tự xin mã mới và gửi lại một lần; POST thẳng vào API không có mã nên dừng ở đây.
      logger.warn("Liên hệ bị từ chối vì mã phiên gửi không hợp lệ.", { request, reason: result.reason });
      const tooFast = result.reason === "too_fast";
      const response = NextResponse.json({ error: { code: tooFast ? "LEAD_TOO_FAST" : "LEAD_TOKEN_INVALID", message: tooFast ? "Bạn gửi hơi nhanh. Vui lòng đợi vài giây rồi gửi lại." : "Phiên gửi đã hết hạn. Vui lòng tải lại trang rồi gửi lại." } }, { status: tooFast ? 429 : 400 });
      if (tooFast && result.retryAfterSeconds) response.headers.set("retry-after", String(result.retryAfterSeconds));
      return response;
    }
    // Trùng hoặc bị ô bẫy chặn cũng trả đúng thông điệp này: không cho bot biết lý do.
    return NextResponse.json({ message: "Cảm ơn bạn. iOrder đã nhận được thông tin và sẽ liên hệ sớm." }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Chỉ ghi tên trường và loại lỗi, không ghi nội dung khách nhập (số điện thoại, email là dữ liệu cá nhân). Nhờ log này mà
      // lỗi "biểu mẫu gửi thiếu trường API bắt buộc" lộ ra ngay thay vì chỉ thấy thông báo chung cho khách.
      logger.warn("Liên hệ bị từ chối vì dữ liệu không hợp lệ.", { request, issues: error.issues.map((issue) => `${issue.path.join(".") || "(gốc)"}: ${issue.code}`) });
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Vui lòng nhập họ tên, số điện thoại thật và email hợp lệ (nếu có); lời nhắn không chứa nhiều liên kết." } }, { status: 400 });
    }
    logger.error("Không lưu được liên hệ của khách.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Chưa thể gửi liên hệ lúc này. Vui lòng thử lại sau." } }, { status: 500 });
  }
}
