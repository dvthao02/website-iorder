// Đọc tệp `file` từ biểu mẫu multipart nhưng dừng ngay khi vượt giới hạn, không nạp cả thân request vào bộ nhớ trước.
export type UploadReadResult = { ok: true; file: File } | { ok: false; code: "INVALID_INPUT" | "PAYLOAD_TOO_LARGE"; message: string };

export async function readUploadedFile(request: Request, maxBytes: number, tooLargeMessage: string): Promise<UploadReadResult> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data")) return { ok: false, code: "INVALID_INPUT", message: "Vui lòng gửi tệp bằng biểu mẫu tải lên." };
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, code: "INVALID_INPUT", message: "Chưa chọn tệp tải lên." };
  // Phần bao multipart (ranh giới, tên trường) nặng thêm chút ít so với tệp.
  const limit = maxBytes + 64 * 1024;
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        return { ok: false, code: "PAYLOAD_TOO_LARGE", message: tooLargeMessage };
      }
      chunks.push(value);
    }
    const file = (await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData()).get("file");
    return file instanceof File ? { ok: true, file } : { ok: false, code: "INVALID_INPUT", message: "Chưa chọn tệp tải lên." };
  } catch {
    return { ok: false, code: "INVALID_INPUT", message: "Không đọc được biểu mẫu tải lên." };
  }
}
