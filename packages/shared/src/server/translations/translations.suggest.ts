// Gợi ý bản dịch cho câu chưa dịch dựa trên câu đã dịch chỉ khác hoa/thường, dấu câu cuối hoặc khoảng trắng
// ("Trang Chủ" ↔ "Trang chủ", "Xem thêm," ↔ "Xem thêm", "Email:" ↔ "Email"). Chỉ là gợi ý để người dịch duyệt, không tự áp lên website.

const trailingPunctuation = /[\s.:;!?…,]+$/u;

/** Dạng so sánh của một câu: bỏ hoa/thường, dấu câu cuối và khoảng trắng thừa. */
export function foldSentence(text: string) {
  return text.normalize("NFC").toLowerCase().replace(trailingPunctuation, "").replace(/\s+/g, " ").trim();
}

const firstLetterIndex = (text: string) => text.search(/\p{L}/u);
const isLower = (char: string) => char !== char.toUpperCase();
const isUpper = (char: string) => char !== char.toLowerCase();
const isAllCaps = (text: string) => /\p{L}.*\p{L}/u.test(text) && text === text.toUpperCase() && text !== text.toLowerCase();

/**
 * Đưa bản dịch của câu `donor` về dạng của câu `target` (hai câu cùng `foldSentence`): dấu câu cuối theo `target`, chữ cái đầu hoa/thường theo `target`,
 * câu viết hoa toàn bộ thì bản dịch cũng viết hoa toàn bộ.
 */
export function adaptTranslation(target: string, donor: string, donorValue: string) {
  if (target === donor) return donorValue;
  const targetPunctuation = target.match(trailingPunctuation)?.[0] ?? "";
  let value = donorValue.replace(trailingPunctuation, "");
  if (!value) return donorValue;
  if (isAllCaps(target) && !isAllCaps(donor)) value = value.toUpperCase();
  else {
    const targetIndex = firstLetterIndex(target);
    const donorIndex = firstLetterIndex(donor);
    const valueIndex = firstLetterIndex(value);
    if (targetIndex >= 0 && donorIndex >= 0 && valueIndex >= 0) {
      const targetChar = target[targetIndex];
      const donorChar = donor[donorIndex];
      const valueChar = value[valueIndex];
      // Từ đầu có chữ hoa ở giữa/sau chữ đầu (VAT, iOrder, QR) là viết tắt hoặc tên riêng: không hạ chữ đầu.
      const firstWord = value.slice(valueIndex).match(/^\p{L}+/u)?.[0] ?? "";
      const keepsCase = firstWord.length > 1 && firstWord.slice(1) !== firstWord.slice(1).toLowerCase();
      if (isLower(targetChar) && isUpper(donorChar) && isUpper(valueChar) && !keepsCase) value = value.slice(0, valueIndex) + valueChar.toLowerCase() + value.slice(valueIndex + 1);
      else if (isUpper(targetChar) && isLower(donorChar) && isLower(valueChar)) value = value.slice(0, valueIndex) + valueChar.toUpperCase() + value.slice(valueIndex + 1);
    }
  }
  return value + targetPunctuation;
}

export type SuggestionSource = { text: string; value: string };
export type Suggestion = { value: string; from: string };

/**
 * Bảng tra gợi ý từ các câu đã có bản dịch còn hiệu lực. Một câu có nhiều câu giống nhau với bản dịch khác nhau thì lấy bản dịch được dùng nhiều nhất
 * (bằng nhau thì bản đầu tiên). Câu giống hệt chữ cũng được gợi ý: chữ giao diện (ui.*) và chữ nội dung CMS là hai khóa khác nhau dù cùng chữ ("Phần mềm").
 * Người gọi chỉ đưa vào các câu đã dịch, nên câu đang cần dịch không bao giờ tự gợi ý cho chính nó.
 */
export function createSuggester(translated: Iterable<SuggestionSource>) {
  const byFold = new Map<string, Map<string, { source: SuggestionSource; count: number }>>();
  for (const source of translated) {
    const fold = foldSentence(source.text);
    if (!fold || !source.value.trim()) continue;
    const candidates = byFold.get(fold) ?? new Map();
    const known = candidates.get(source.value);
    if (known) known.count += 1; else candidates.set(source.value, { source, count: 1 });
    byFold.set(fold, candidates);
  }
  return (text: string): Suggestion | undefined => {
    const candidates = byFold.get(foldSentence(text));
    if (!candidates) return undefined;
    let best: { source: SuggestionSource; count: number } | undefined;
    for (const candidate of candidates.values()) if (!best || candidate.count > best.count) best = candidate;
    if (!best) return undefined;
    return { value: adaptTranslation(text, best.source.text, best.source.value), from: best.source.text };
  };
}
