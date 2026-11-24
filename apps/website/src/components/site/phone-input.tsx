"use client";

// Các bài kiểm thử chạy JSX theo kiểu cũ nên cần React trong phạm vi (giống lead-form.tsx).
import React, { type FocusEvent, type FormEvent } from "react";
import { isValidPhone, normalizePhone, phoneRule, sanitizePhoneInput } from "@iorder/shared/server/leads/leads.phone";

// Ô số điện thoại dùng chung cho mọi biểu mẫu liên hệ (biểu mẫu trong trang, tư vấn tự hiện, hỏi mua thiết bị). Cùng quy tắc với Backend
// (leads.phone.ts): chỉ gõ được chữ số, "+" ở đầu, khoảng trắng và . - ( ); sai thì trình duyệt chặn Gửi kèm lời nhắc; rời ô thì
// "+84 912 345 678" tự đổi thành "0912345678" để khách thấy đúng số sẽ được lưu.
export function PhoneInput({ className, enterKeyHint }: { className: string; enterKeyHint?: "next" | "send" }) {
  function check(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const cleaned = sanitizePhoneInput(input.value);
    if (cleaned !== input.value) input.value = cleaned;
    input.setCustomValidity(!cleaned.trim() || isValidPhone(cleaned) ? "" : phoneRule);
  }
  function tidy(event: FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (isValidPhone(input.value)) input.value = normalizePhone(input.value);
  }
  return <input autoComplete="tel" className={className} enterKeyHint={enterKeyHint} inputMode="tel" maxLength={20} name="phone" onBlur={tidy} onInput={check} placeholder="09xx xxx xxx" required title={phoneRule} type="tel" />;
}
