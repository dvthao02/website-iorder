// Số điện thoại khách nhập ở mọi biểu mẫu liên hệ. Hàm thuần, không phụ thuộc Node, nên dùng được cả ở trình duyệt (ô nhập)
// lẫn Backend (kiểm lại và lưu), hai nơi cùng một quy tắc:
//   - Chỉ gồm chữ số, dấu "+" ở đầu, khoảng trắng, dấu chấm, gạch ngang và ngoặc.
//   - "+84" (hoặc 84, 0084) thay cho số 0 đầu: +84 912 345 678 và 0912 345 678 là cùng một số, lưu dạng 0912345678.
//   - Sau khi đổi, đúng 10 hoặc 11 chữ số và bắt đầu bằng 0 (di động 10 số, máy bàn có mã vùng 11 số).

export const phoneRule = "Số điện thoại gồm 10–11 chữ số, bắt đầu bằng 0 (hoặc +84 thay cho số 0 đầu).";

const allowedCharacters = /^\+?[\d\s.()-]*$/;
// Mã nước 84, có thể kèm tiền tố quốc tế 00 và số 0 thừa sau mã nước ("+84 (0) 912…"); phần còn lại là số trong nước bỏ số 0 đầu (9–10 chữ số).
const internationalPhone = /^(?:00)?84(?:0)?([1-9]\d{8,9})$/;

/** Chỉ giữ chữ số; số quốc tế +84 / 84 / 0084 đổi về số 0 đầu. Số không đúng dạng thì chỉ bị bỏ ký tự không phải số (và vẫn không hợp lệ). */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const international = internationalPhone.exec(digits);
  return international ? `0${international[1]}` : digits;
}

/** Số điện thoại hợp lệ: ký tự cho phép, "+" chỉ đi với mã nước 84, sau khi đổi có 10–11 chữ số bắt đầu bằng 0 và không phải dãy lặp (0000000000, 0909090909). */
export function isValidPhone(raw: string) {
  const text = raw.trim();
  if (!allowedCharacters.test(text)) return false;
  if (text.startsWith("+") && !/^\+\s*84/.test(text)) return false;
  const digits = normalizePhone(text);
  return /^0\d{9,10}$/.test(digits) && new Set(digits).size > 2;
}

/** Bỏ ký tự khách không được gõ vào ô số điện thoại: chỉ giữ chữ số, khoảng trắng, . - ( ) và một dấu "+" ở đầu. */
export function sanitizePhoneInput(raw: string) {
  const leadingPlus = raw.trimStart().startsWith("+");
  const rest = raw.replace(/[^\d\s.()-]/g, "");
  return leadingPlus ? `+${rest.trimStart()}` : rest;
}

export type PhoneDisplay = { text: string; digits: string; valid: boolean };

/**
 * Số điện thoại để hiển thị trong CMS. Số hợp lệ về dạng chuẩn và nhóm chữ số (0964 350 515; máy bàn 028 7107 3999),
 * kể cả liên hệ cũ lưu dạng +84…; số cũ không đạt quy tắc (thiếu số 0 đầu, thừa số…) giữ nguyên như khách đã nhập để nhân viên tự xem xét.
 */
export function formatPhoneDisplay(raw: string): PhoneDisplay {
  const digits = normalizePhone(raw);
  if (!isValidPhone(raw)) return { text: raw.trim(), digits, valid: false };
  const text = digits.length === 11 ? `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}` : `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return { text, digits, valid: true };
}
