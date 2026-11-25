"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createTranslate, type Translate } from "../../lib/translate";

// Bản dịch chữ cố định của ngôn ngữ đang xem (chỉ các khóa đã dịch), do layout gốc lấy từ Backend một lần mỗi lượt xem rồi đưa xuống các thành phần
// chạy trên trình duyệt. Không có nhà cung cấp (trang lỗi toàn cục) hoặc chưa dịch khóa nào thì `useT()` trả tiếng Việt trong code.
const MessagesContext = createContext<Record<string, string>>({});

export function MessagesProvider({ messages, children }: { messages: Record<string, string>; children: ReactNode }) {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>;
}

/** Hàm dịch chữ cố định cho thành phần chạy trên trình duyệt: `const t = useT(); t("header.openMenu")`. */
export function useT(): Translate {
  const messages = useContext(MessagesContext);
  return useMemo(() => createTranslate(messages), [messages]);
}
