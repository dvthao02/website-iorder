import { NextResponse } from "next/server";
import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getAdminMedia, InvalidMediaError, uploadAdminMedia } from "@iorder/core/server/media/media.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });
  const administrator = await getRequestAdministrator();
  if (!administrator) return fail("UNAUTHORIZED", "Vui lòng đăng nhập lại.", 401);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return fail("FORBIDDEN", "Nguồn gửi yêu cầu không hợp lệ.", 403);
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data")) return fail("INVALID_INPUT", "Vui lòng gửi tệp bằng biểu mẫu tải lên.", 400);
  const reader = request.body?.getReader();
  if (!reader) return fail("INVALID_INPUT", "Chưa chọn tệp tải lên.", 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  let file: FormDataEntryValue | null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 21 * 1024 * 1024) {
        await reader.cancel();
        return fail("PAYLOAD_TOO_LARGE", "Tệp tải lên không được vượt quá 20 MB.", 413);
      }
      chunks.push(value);
    }
    file = (await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData()).get("file");
  } catch { return fail("INVALID_INPUT", "Không đọc được biểu mẫu tải lên.", 400); }
  if (!(file instanceof File)) return fail("INVALID_INPUT", "Chưa chọn tệp tải lên.", 400);
  try {
    return NextResponse.json({ asset: await uploadAdminMedia(file, administrator.userId) }, { status: 201 });
  } catch (error) {
    return error instanceof InvalidMediaError ? fail("INVALID_INPUT", error.message, 400)
      : fail("INTERNAL_ERROR", "Không thể tải tệp lên. Vui lòng thử lại.", 500);
  }
}

export async function GET() {
  if (!await getRequestAdministrator()) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  try {
    return NextResponse.json({ assets: await getAdminMedia() });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Không thể tải thư viện tệp." } }, { status: 500 });
  }
}
