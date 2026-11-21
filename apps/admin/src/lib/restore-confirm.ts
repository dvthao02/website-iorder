// Từ phải gõ để xác nhận phục hồi dữ liệu. Chọn từ ngắn, dễ nhớ, tiếng Việt thường ngày; so khớp bỏ qua
// hoa/thường, dấu và khoảng trắng thừa để người không rành máy tính (gõ không dấu, bật Caps Lock…) vẫn gõ được.
export const restoreConfirmWord = "phục hồi";

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/\s+/g, " ").trim().toLowerCase();

export function matchesRestoreConfirmation(typed: string) {
  return normalize(typed) === normalize(restoreConfirmWord);
}
