// Từ phải gõ để xác nhận thao tác không hoàn tác được (phục hồi dữ liệu, xóa bản sao lưu). Chọn từ ngắn, dễ nhớ,
// tiếng Việt thường ngày; so khớp bỏ qua hoa/thường, dấu và khoảng trắng thừa để người không rành máy tính
// (gõ không dấu, bật Caps Lock…) vẫn gõ được.
export const restoreConfirmWord = "phục hồi";
export const deleteConfirmWord = "xóa";

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/\s+/g, " ").trim().toLowerCase();

export function matchesConfirmationWord(typed: string, word: string) {
  return normalize(typed) === normalize(word);
}

export function matchesRestoreConfirmation(typed: string) {
  return matchesConfirmationWord(typed, restoreConfirmWord);
}
