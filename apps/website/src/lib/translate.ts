import { formatMessage, uiMessages, type UiMessageKey } from "@iorder/shared/server/translations/ui-messages";

/** Hàm dịch chữ cố định: `t("header.openMenu")`, có biến thì `t("header.openSubmenu", { label })`. */
export type Translate = (key: UiMessageKey, vars?: Record<string, string | number>) => string;

/**
 * Tạo hàm dịch từ các bản dịch đã nhập trong CMS (`overrides`: chỉ những khóa đã dịch). Khóa chưa dịch dùng tiếng Việt trong code,
 * nên website luôn có chữ dù chưa nhập bản dịch nào hoặc Backend không trả được bản dịch.
 */
export function createTranslate(overrides: Record<string, string> = {}): Translate {
  return (key, vars) => formatMessage(overrides[key] ?? uiMessages[key], vars);
}
