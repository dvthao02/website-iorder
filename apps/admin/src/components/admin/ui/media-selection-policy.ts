import { documentMediaTypes, imageMediaTypes, socialImageMediaTypes } from "@iorder/shared/server/media/media-types";

/**
 * Loại tệp chọn được ở một ô: tài liệu/tệp nén (`documents`), ảnh bìa/chia sẻ/đại diện (`social`: chỉ PNG, JPEG, WebP vì mạng xã hội không hiện SVG/AVIF)
 * hoặc ảnh dùng trên website (mọi định dạng ảnh web).
 */
export function isSelectableMediaType(mimeType: string, documents: boolean, social = false): boolean {
  const allowed: readonly string[] = documents ? documentMediaTypes : social ? socialImageMediaTypes : imageMediaTypes;
  return allowed.includes(mimeType);
}
