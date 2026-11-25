// Không import zod: file này được hộp thoại tư vấn của website (chạy trong trình duyệt) dùng; contract thì kéo zod (~30 KB gz) theo.
export const isPopupExternalLink = (value: string) => /^https?:\/\/[^\s]+$/i.test(value);
