const dayMs = 24 * 60 * 60 * 1000;

/**
 * Ngày cập nhật hiện cho người đọc ("Cập nhật 20/11/2026"): chỉ khi bài được sửa sau ngày đăng ít nhất một ngày.
 * Sửa lỗi chính tả vài phút sau khi đăng không đáng báo là "cập nhật"; ngày sửa trước ngày đăng (dữ liệu nhập tay) bị bỏ, giống dateModified trong JSON-LD.
 */
export function visibleUpdatedAt(publishedAt: Date | null | undefined, updatedAt: Date | null | undefined) {
  if (!publishedAt || !updatedAt) return null;
  return updatedAt.getTime() - publishedAt.getTime() >= dayMs ? updatedAt : null;
}
