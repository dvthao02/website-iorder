import { NextResponse } from "next/server";
import { z } from "zod";
import { submitPublicLead } from "@iorder/core/server/leads/leads.service";

function clientAddress(request: Request) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"); }

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Dữ liệu liên hệ không hợp lệ." } }, { status: 400 }); }
  try {
    const result = await submitPublicLead(input, clientAddress(request));
    if (!result.accepted) return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Bạn vừa gửi liên hệ. Vui lòng chờ ít phút trước khi gửi lại." } }, { status: 429 });
    return NextResponse.json({ message: "Cảm ơn bạn. iOrder đã nhận được thông tin và sẽ liên hệ sớm." }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Vui lòng nhập họ tên, số điện thoại và email hợp lệ (nếu có)." } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Chưa thể gửi liên hệ lúc này. Vui lòng thử lại sau." } }, { status: 500 });
  }
}
