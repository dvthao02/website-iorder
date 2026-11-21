// Kiểu thẻ "Ảnh ghép" (mosaic) của Lưới thẻ: chia thẻ thành hai hàng, nửa trên ít thẻ hơn nên thẻ rộng hơn, giống bố cục 2 + 3.
// 1 thẻ → [1]; 2 → [1, 1]; 3 → [1, 2]; 4 → [2, 2]; 5 → [2, 3]; 6 → [3, 3]; 7 → [3, 4].
export function mosaicRows(count: number): number[] {
  if (count <= 1) return count === 1 ? [1] : [];
  const top = Math.floor(count / 2);
  return [top, count - top];
}

// Mỗi dòng của mô tả là một ý; từ 2 dòng thì website vẽ thành danh sách (như mục con của một nhóm sản phẩm).
export function descriptionLines(description: string | null | undefined): string[] {
  return (description ?? "").split(/\r?\n/).map((line) => line.replace(/^[-•*]\s+/, "").trim()).filter(Boolean);
}

// Ảnh JPG/AVIF thường là ảnh chụp: phủ kín ô. Ảnh PNG/WebP thường là ảnh sản phẩm nền trong suốt: đặt nổi trên nền màu, không cắt.
export function mosaicMediaKind(mimeType: string | null | undefined): "photo" | "cutout" {
  return mimeType === "image/png" || mimeType === "image/webp" ? "cutout" : "photo";
}
