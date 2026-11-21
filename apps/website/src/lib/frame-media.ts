import type { BlockFrame } from "@iorder/shared/server/pages/block-layout";
import { getMediaById } from "@/lib/backend";

/**
 * Nền của một phần cố định (thông số, thiết bị khác, nội dung liên quan, dải tư vấn…) lưu ảnh nền theo mã media; Section chỉ vẽ được
 * khi có địa chỉ ảnh, nên phải tra mã thành địa chỉ trước. Quên bước này thì ô "Ảnh nền" trong CMS không có tác dụng trên website.
 */
export async function withBackgroundImage(frame: BlockFrame): Promise<BlockFrame> {
  if (!frame.background?.mediaId) return frame;
  const media = await getMediaById(frame.background.mediaId);
  return { ...frame, background: { ...frame.background, imageUrl: media?.mimeType.startsWith("image/") ? media.url : null } };
}
