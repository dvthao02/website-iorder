import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAdministrator } from "@iorder/shared/server/auth/request-administrator";
import { importAdminMediaFromUrl, InvalidMediaError } from "@iorder/shared/server/media/media.service";
import { getOriginalRequestHost, isMediaUploadOriginAllowed } from "@iorder/shared/server/media/media-origin";
import { withRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";
// Tải tệp từ link có thể mất tới 30 giây.
export const maxDuration = 60;

const importRequestSchema = z.object({ url: z.string().trim().min(1).max(1000) }).strict();

// Tự tải tệp từ một link https vào thư viện media (quyền media.create, như tải tệp lên). Máy chủ chỉ tải từ internet công cộng
// (remote-file.ts chặn mạng nội bộ). Kết quả: 201 { result: "imported", asset } hoặc 200 { result: "kept_as_link", reason, message } khi không lưu vào thư viện được.
async function handlePOST(request: Request) {
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  if (!isMediaUploadOriginAllowed(request.headers.get("origin"), getOriginalRequestHost(request.headers))) return fail("FORBIDDEN", "Nguồn gửi yêu cầu không hợp lệ.", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_INPUT", "Dữ liệu gửi lên không hợp lệ.", 400); }
  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) return fail("INVALID_INPUT", "Nhập link tải về cần lấy tệp.", 400);
  try {
    const outcome = await importAdminMediaFromUrl(parsed.data.url, administrator.userId);
    return NextResponse.json(outcome, { status: outcome.result === "imported" ? 201 : 200 });
  } catch (error) {
    return error instanceof InvalidMediaError ? fail("INVALID_INPUT", error.message, 400)
      : fail("INTERNAL_ERROR", "Không thể tải tệp từ link lúc này. Vui lòng thử lại.", 500);
  }
}

export const POST = withRequestContext(handlePOST);
