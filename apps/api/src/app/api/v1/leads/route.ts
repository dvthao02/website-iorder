import { NextResponse } from "next/server";
import { z } from "zod";
import { leadRateLimitMessage } from "@iorder/shared/server/leads/leads.rate-limit";
import { submitPublicLead } from "@iorder/shared/server/leads/leads.service";
import { logger } from "@iorder/shared/server/shared/logger";
import { getClientAddress } from "@/lib/client-address";
function clientAddress(request: Request) { return getClientAddress(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip")); }

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Dữ liệu liên hệ không hợp lệ." } }, { status: 400 }); }
  try {
    const result = await submitPublicLead(input, clientAddress(request));
    if (!result.accepted) {
      const response = NextResponse.json({ error: { code: "RATE_LIMITED", message: leadRateLimitMessage(result.retryAfterSeconds) } }, { status: 429 });
      response.headers.set("retry-after", String(result.retryAfterSeconds));
      return response;
    }
    return NextResponse.json({ message: "Cảm ơn bạn. iOrder đã nhận được thông tin và sẽ liên hệ sớm." }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Chỉ ghi tên trường và loại lỗi, không ghi nội dung khách nhập (số điện thoại, email là dữ liệu cá nhân). Nhờ log này mà
      // lỗi "biểu mẫu gửi thiếu trường API bắt buộc" lộ ra ngay thay vì chỉ thấy thông báo chung cho khách.
      logger.warn("Liên hệ bị từ chối vì dữ liệu không hợp lệ.", { request, issues: error.issues.map((issue) => `${issue.path.join(".") || "(gốc)"}: ${issue.code}`) });
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Vui lòng nhập họ tên, số điện thoại và email hợp lệ (nếu có)." } }, { status: 400 });
    }
    logger.error("Không lưu được liên hệ của khách.", { request, error });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Chưa thể gửi liên hệ lúc này. Vui lòng thử lại sau." } }, { status: 500 });
  }
}
