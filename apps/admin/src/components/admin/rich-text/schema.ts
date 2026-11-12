import { generateJSON } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";

import type { RichDocument } from "@iorder/shared/server/shared/rich-text";
import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { ImageBanner, SizedImage, YouTubeVideo } from "./extensions";

// Một bộ extension cho trình soạn thảo và cho nhập file hàng loạt, để HTML từ Word được hiểu y như khi dán vào trình soạn.
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer", target: null } },
  }),
  SizedImage,
  ImageBanner,
  YouTubeVideo,
  TableKit.configure({ table: { resizable: false } }),
];

/** HTML (đã chuẩn hóa bởi import-content) → tài liệu soạn thảo; thẻ ngoài schema bị bỏ, máy chủ còn làm sạch lại khi lưu. */
export function htmlToRichDocument(html: string): RichDocument {
  return generateJSON(html, richTextExtensions) as RichDocument;
}

/** Tải ảnh lên Thư viện media, trả đường dẫn /media/… để chèn vào nội dung. */
export async function uploadContentImage(file: File) {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch("/api/admin/media", { method: "POST", body });
  const payload = await readAdminJson(response);
  const url = payload?.asset?.url;
  if (!response.ok || typeof url !== "string") throw adminApiError(payload, "Không tải được ảnh lên.");
  return url;
}
