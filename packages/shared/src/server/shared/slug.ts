// Slug từ tiêu đề tiếng Việt: bỏ dấu, "đ" -> "d", chỉ giữ a-z, 0-9 và gạch nối (khớp regex slug của Backend).
// Dùng chung cho CMS (ô đường dẫn) và nhập dữ liệu từ file (dòng mới để trống slug).
export function toSlug(text: string, maxLength = 180) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
