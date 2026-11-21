import { mediaAssetSchema, type MediaAsset } from "@iorder/shared/server/media/media.contract";
import { externalUrlProblem } from "@iorder/shared/server/shared/external-url";

// Quyết định của luồng "nhập link tệp cài đặt" (tách khỏi form để kiểm thử được mà không cần ngữ cảnh router).

export type LinkImportOutcome = { kind: "imported"; asset: MediaAsset } | { kind: "link"; message: string };

const fallbackMessage = "Không lưu được tệp vào thư viện.";

/** Đọc phản hồi của `POST /api/v1/admin/media/import-url`: tệp đã vào thư viện, hoặc giữ nguyên dạng link kèm lý do. Phản hồi lạ coi là giữ link. */
export function interpretLinkImport(payload: unknown): LinkImportOutcome {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (body.result === "imported") {
    const asset = mediaAssetSchema.safeParse(body.asset);
    if (asset.success) return { kind: "imported", asset: asset.data };
  }
  return { kind: "link", message: typeof body.message === "string" && body.message.trim() ? body.message.trim() : fallbackMessage };
}

/** Có tự tải khi người dùng dán hoặc rời ô nhập không: bật tự tải, link hợp lệ và khác link vừa thử (không tải lại cùng một link). */
export function shouldAutoImportLink(input: { autoImport: boolean; url: string; lastTried: string }): boolean {
  const url = input.url.trim();
  return input.autoImport && url !== "" && url !== input.lastTried && externalUrlProblem(url) === null;
}

/** Tên hiển thị gợi ý từ link: đoạn cuối của đường dẫn, bỏ đuôi và dấu gạch; rỗng nếu link không có tên tệp. */
export function titleFromLink(url: string): string {
  let name = "";
  try { name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? ""); } catch { return ""; }
  return name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
}
