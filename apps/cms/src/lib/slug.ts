// Slug từ tiêu đề tiếng Việt: bỏ dấu, "đ" -> "d", chỉ giữ a-z, 0-9 và gạch nối (khớp regex slug của Backend).
export function toSlug(text: string, maxLength = 180) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
