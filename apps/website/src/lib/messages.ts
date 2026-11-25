import { getUiMessageOverrides } from "@/lib/backend";
import { createTranslate, type Translate } from "@/lib/translate";

/**
 * Hàm dịch chữ cố định cho thành phần chạy trên máy chủ: `const t = await getT(); t("footer.hotline")`.
 * Thành phần chạy trên trình duyệt dùng `useT()` (components/site/messages-provider.tsx).
 */
export async function getT(): Promise<Translate> {
  return createTranslate(await getUiMessageOverrides());
}
