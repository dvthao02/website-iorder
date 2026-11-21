import { getMediaById } from "@/lib/backend";

/**
 * Ảnh đại diện của bài cho dữ liệu cấu trúc Article: ảnh bìa; bài chưa có ảnh bìa dùng ảnh chia sẻ mặc định của website (Cài đặt),
 * cùng ảnh mà thẻ og:image đang dùng. Google khuyến nghị Article luôn có `image`. Không có cả hai thì null.
 */
export async function articleImagePath(coverUrl: string | null | undefined, defaultOgMediaId: string | null | undefined) {
  if (coverUrl) return coverUrl;
  const media = defaultOgMediaId ? await getMediaById(defaultOgMediaId) : null;
  return media?.mimeType.startsWith("image/") ? media.url : null;
}
