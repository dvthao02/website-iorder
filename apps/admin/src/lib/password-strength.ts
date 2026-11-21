import { ownPasswordMinLength } from "@iorder/shared/server/auth/account.contract";

export type PasswordStrengthLevel = "empty" | "too_short" | "weak" | "fair" | "good" | "strong";

export type PasswordAssessment = {
  level: PasswordStrengthLevel;
  label: string;
  /** Số ô sáng trên thanh 4 ô. */
  segments: 0 | 1 | 2 | 3 | 4;
  /** Độ dài tính như máy chủ (số đơn vị UTF-16 của chuỗi). */
  length: number;
  minLength: number;
  /** Máy chủ sẽ chấp nhận mật khẩu này: đủ dài và khác mật khẩu hiện tại. Mức "Yếu" vẫn được chấp nhận, thanh báo chỉ để tham khảo. */
  acceptable: boolean;
  /** Gợi ý ngắn nhất để mật khẩu tốt hơn (hoặc yêu cầu còn thiếu). */
  tip: string;
};

type AssessOptions = {
  currentPassword?: string;
  username?: string;
  /** Form quản trị viên đặt mật khẩu cho người khác: mật khẩu ngắn hoặc yếu vẫn lưu được, thanh báo chỉ cảnh báo (không có mật khẩu hiện tại để so). */
  lenient?: boolean;
};

const labels: Record<Exclude<PasswordStrengthLevel, "empty" | "too_short">, string> = { weak: "Yếu", fair: "Trung bình", good: "Khá", strong: "Mạnh" };
const segmentsByLevel = { empty: 0, too_short: 1, weak: 1, fair: 2, good: 3, strong: 4 } as const;

// Từ và dãy phím/số mà kẻ dò mật khẩu thử trước. Chữ tiếng Việt được bỏ dấu trước khi so ("mật khẩu" → "matkhau").
const commonPatterns = ["matkhau", "password", "passw0rd", "iorder", "admin", "qwerty", "asdfgh", "abcdef", "letmein", "welcome", "123456", "654321", "111111", "000000", "0123456789", "9876543210"];

// Bỏ dấu tiếng Việt, hạ chữ thường và bỏ mọi ký tự không phải chữ/số: "Mật-khẩu 12 34" so được với "matkhau" và "1234".
function foldVietnamese(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function countCharacterClasses(password: string) {
  return [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{Nd}]/u].filter((pattern) => pattern.test(password)).length;
}

/**
 * Ước lượng độ mạnh để người dùng chọn mật khẩu tốt hơn; không thay thế luật của máy chủ (chỉ cần ≥ 10 ký tự và khác mật khẩu hiện tại).
 * Điểm = độ dài (1–4) + số loại ký tự trừ một (0–3), trừ 2 nếu chứa từ dễ đoán hoặc tên đăng nhập.
 * Cố ý đơn giản và dễ giải thích; không phải bộ đo entropy đầy đủ.
 */
export function assessPassword(password: string, options: AssessOptions = {}): PasswordAssessment {
  const length = password.length;
  const base = { length, minLength: ownPasswordMinLength };
  const lenient = options.lenient === true;
  if (length === 0) return { ...base, level: "empty", label: "", segments: 0, acceptable: false, tip: lenient ? `Nên dùng từ ${ownPasswordMinLength} ký tự trở lên.` : `Ít nhất ${ownPasswordMinLength} ký tự, khác mật khẩu đang dùng.` };
  if (length < ownPasswordMinLength) return { ...base, level: "too_short", label: "Quá ngắn", segments: 1, acceptable: lenient, tip: lenient ? `Rất dễ bị đoán. Vẫn lưu được, nhưng nên dùng từ ${ownPasswordMinLength} ký tự trở lên.` : `Cần thêm ${ownPasswordMinLength - length} ký tự nữa.` };

  const folded = foldVietnamese(password);
  const username = options.username ? foldVietnamese(options.username.trim()) : "";
  const containsUsername = username.length >= 3 && folded.includes(username);
  const containsCommon = commonPatterns.some((pattern) => folded.includes(pattern));
  const fewDistinct = new Set(password).size <= 3;
  const classes = countCharacterClasses(password);

  const lengthPoints = length >= 20 ? 4 : length >= 16 ? 3 : length >= 12 ? 2 : 1;
  const points = Math.max(0, lengthPoints + (classes - 1) - (containsUsername ? 2 : 0) - (containsCommon ? 2 : 0));
  const level: "weak" | "fair" | "good" | "strong" = fewDistinct || points <= 2 ? "weak" : points <= 4 ? "fair" : points === 5 ? "good" : "strong";

  const sameAsCurrent = options.currentPassword !== undefined && password === options.currentPassword;
  let tip: string;
  if (sameAsCurrent) tip = "Phải khác mật khẩu hiện tại.";
  else if (containsUsername) tip = "Đừng dùng tên đăng nhập trong mật khẩu.";
  else if (containsCommon) tip = "Tránh từ dễ đoán như “matkhau” hoặc dãy số 123456.";
  else if (fewDistinct) tip = "Dùng nhiều ký tự khác nhau hơn.";
  else if (level === "strong") tip = "Đủ mạnh.";
  else if (length < 16) tip = "Dài từ 16 ký tự sẽ an toàn hơn.";
  else if (classes < 3) tip = "Trộn chữ hoa, chữ thường, số và ký hiệu để khó đoán hơn.";
  else tip = "Tốt. Thêm độ dài để mạnh hơn.";

  // Trùng mật khẩu hiện tại: máy chủ từ chối, nên luôn hiện mức thấp nhất bất kể mật khẩu đó "mạnh" đến đâu.
  const shown = sameAsCurrent ? "weak" : level;
  return { ...base, level: shown, label: labels[shown], segments: segmentsByLevel[shown], acceptable: !sameAsCurrent, tip };
}
