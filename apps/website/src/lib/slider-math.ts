// Dải ảnh trượt tự động ("slider" của Lưới thẻ): số trang, ảnh kế tiếp và vị trí đang xem tính từ thanh cuộn.
// "Trang" = một vị trí dừng của dải; dải hiện `visible` ảnh cùng lúc nên có (tổng − visible + 1) vị trí.
export function sliderPages(total: number, visible: number): number {
  return Math.max(1, total - Math.max(1, visible) + 1);
}

// Hết dải thì quay về đầu.
export function nextSliderIndex(current: number, pages: number): number {
  return current + 1 >= pages ? 0 : current + 1;
}

export function previousSliderIndex(current: number, pages: number): number {
  return current - 1 < 0 ? pages - 1 : current - 1;
}

// `step`: khoảng cách giữa hai ảnh liên tiếp (rộng ảnh + khoảng hở).
export function sliderIndexFromScroll(scrollLeft: number, step: number, pages: number): number {
  if (!(step > 0)) return 0;
  return Math.min(pages - 1, Math.max(0, Math.round(scrollLeft / step)));
}
